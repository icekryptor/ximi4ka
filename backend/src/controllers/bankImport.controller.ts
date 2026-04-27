import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankAccount } from '../entities/BankAccount'
import { Transaction } from '../entities/Transaction'
import { parse, detectBank, BankCode } from '../services/bank-parsers'
import { suggestMatch } from '../services/import-matcher'
import { detectTransfer } from '../services/transfer-detector'
import { BankImport } from '../entities/BankImport'
import { ImportRule } from '../entities/ImportRule'
import { Counterparty } from '../entities/Counterparty'

export interface PreviewRowOut {
  index: number
  external_id: string | null
  date: string
  type: 'income' | 'expense'
  amount: number
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  // Suggestions
  suggested_counterparty_id: string | null
  suggested_counterparty_name: string | null
  suggested_category_id: string | null
  suggested_category_name: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
  matched_rule_id: string | null
  // Flags
  is_duplicate: boolean
  is_transfer: boolean
  transfer_match_id: string | null
}

export interface PreviewResponse {
  bank_code: BankCode
  bank_account_id: string
  period_start: string | null
  period_end: string | null
  total_rows: number
  warnings: string[]
  rows: PreviewRowOut[]
}

export const bankImportController = {
  async preview(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ error: 'Файл не передан' }); return }

      const file = req.file
      let bankAccountId = req.body.bank_account_id as string | undefined
      let bankCode = req.body.bank_code as BankCode | undefined

      // Auto-detect bank if not specified
      if (!bankCode) {
        const detected = detectBank(file.buffer)
        if (!detected) { res.status(400).json({ error: 'Не удалось определить банк по файлу. Укажите счёт.' }); return }
        bankCode = detected
      }

      // Resolve bank_account by code if not specified
      if (!bankAccountId) {
        const acc = await AppDataSource.getRepository(BankAccount).findOne({ where: { bank_code: bankCode, is_active: true } })
        if (!acc) { res.status(404).json({ error: `Счёт для банка ${bankCode} не найден` }); return }
        bankAccountId = acc.id
      }

      const result = parse(file.buffer, bankCode)

      // Pre-fetch existing external_ids for this account to flag duplicates
      const txRepo = AppDataSource.getRepository(Transaction)
      const externalIds = result.rows.map(r => r.external_id).filter(Boolean) as string[]
      const existing = externalIds.length === 0
        ? []
        : await txRepo.createQueryBuilder('t')
            .where('t.bank_account_id = :acc', { acc: bankAccountId })
            .andWhere('t.external_id IN (:...ids)', { ids: externalIds })
            .select(['t.external_id'])
            .getMany()
      const existingSet = new Set(existing.map(t => t.external_id))

      // Build preview rows in parallel chunks of 25 (limit DB pressure)
      const out: PreviewRowOut[] = []
      const CHUNK = 25
      for (let i = 0; i < result.rows.length; i += CHUNK) {
        const chunk = result.rows.slice(i, i + CHUNK)
        const enriched = await Promise.all(chunk.map(async (row, idx) => {
          const sug = await suggestMatch(row)
          const transfer = sug.is_inter_transfer
            ? null
            : await detectTransfer(row, bankAccountId!)
          return {
            index: i + idx,
            external_id: row.external_id,
            date: row.date,
            type: row.type,
            amount: row.amount,
            counterparty_name: row.counterparty_name,
            counterparty_inn: row.counterparty_inn,
            description: row.description,
            suggested_counterparty_id: sug.counterparty_id,
            suggested_counterparty_name: sug.counterparty_name,
            suggested_category_id: sug.category_id,
            suggested_category_name: sug.category_name,
            match_quality: sug.match_quality,
            matched_rule_id: sug.matched_rule_id,
            is_duplicate: row.external_id ? existingSet.has(row.external_id) : false,
            is_transfer: sug.is_inter_transfer || !!transfer,
            transfer_match_id: transfer?.matched_transaction_id || null,
          } as PreviewRowOut
        }))
        out.push(...enriched)
      }

      const response: PreviewResponse = {
        bank_code: result.bank_code,
        bank_account_id: bankAccountId,
        period_start: result.period_start,
        period_end:   result.period_end,
        total_rows: result.rows.length,
        warnings: result.warnings,
        rows: out,
      }
      res.json(response)
    } catch (err: any) {
      console.error('[bankImport.preview]', err)
      res.status(500).json({ error: err.message || 'Ошибка превью' })
    }
  },

  async commit(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId
      const {
        bank_account_id,
        file_name,
        period_start,
        period_end,
        rows,             // array of confirmed PreviewRowOut + manual edits
        rules_to_create,  // array of { match_type, match_value, counterparty_id, category_id, is_inter_transfer }
      } = req.body as {
        bank_account_id: string
        file_name: string
        period_start: string | null
        period_end: string | null
        rows: Array<{
          external_id: string | null
          date: string
          type: 'income' | 'expense'
          amount: number
          counterparty_name: string
          counterparty_inn: string | null
          description: string
          counterparty_id: string | null
          category_id: string | null
          is_transfer: boolean
          transfer_match_id: string | null
          skip: boolean       // user can skip duplicates / unwanted rows
        }>
        rules_to_create: Array<{
          match_type: 'inn' | 'name_keyword' | 'description_keyword'
          match_value: string
          counterparty_id: string | null
          category_id: string | null
          is_inter_transfer: boolean
        }>
      }

      if (!bank_account_id || !Array.isArray(rows)) {
        res.status(400).json({ error: 'bank_account_id и rows обязательны' }); return
      }

      const importRepo = AppDataSource.getRepository(BankImport)
      const txRepo     = AppDataSource.getRepository(Transaction)
      const cpRepo     = AppDataSource.getRepository(Counterparty)
      const ruleRepo   = AppDataSource.getRepository(ImportRule)

      // Create import session
      const session = importRepo.create({
        bank_account_id,
        file_name: file_name || 'unknown.xlsx',
        period_start, period_end,
        total_rows: rows.length,
        imported_rows: 0,
        skipped_duplicates: 0,
        status: 'pending',
        imported_by: userId || null,
      })
      const savedSession = await importRepo.save(session)

      let importedRows = 0
      let skipped = 0
      const transferLinks: Array<{ a: string; b: string }> = []

      const activeRows = rows.filter(r => !r.skip)
      skipped = rows.length - activeRows.length

      // ── 1. Pre-fetch existing counterparties by INN to deduplicate creates ──
      const innsToLookup = Array.from(new Set(
        activeRows
          .filter(r => !r.counterparty_id && r.counterparty_inn)
          .map(r => r.counterparty_inn!)
      ))
      const existingByInn = new Map<string, string>()
      if (innsToLookup.length > 0) {
        const found = await cpRepo.createQueryBuilder('cp')
          .select(['cp.id', 'cp.inn'])
          .where('cp.inn IN (:...inns)', { inns: innsToLookup })
          .getMany()
        found.forEach(cp => existingByInn.set((cp as any).inn, cp.id))
      }

      // ── 2. Build list of NEW counterparties to create (deduped by INN+name) ──
      type NewCp = { key: string; name: string; inn: string | null }
      const newCpMap = new Map<string, NewCp>()
      for (const r of activeRows) {
        if (r.counterparty_id) continue
        if (!r.counterparty_name) continue
        if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) continue
        const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
        if (!newCpMap.has(key)) {
          newCpMap.set(key, { key, name: r.counterparty_name, inn: r.counterparty_inn || null })
        }
      }

      // ── 3. Bulk-insert new counterparties via single INSERT ──
      const newCpKeyToId = new Map<string, string>()
      if (newCpMap.size > 0) {
        const newCpList = Array.from(newCpMap.values())
        const insertResult = await cpRepo.insert(
          newCpList.map(cp => ({ name: cp.name, inn: cp.inn })) as any[]
        )
        newCpList.forEach((cp, idx) => {
          newCpKeyToId.set(cp.key, (insertResult.identifiers[idx] as any).id)
        })
      }

      const resolveCounterpartyId = (r: typeof activeRows[number]): string | null => {
        if (r.counterparty_id) return r.counterparty_id
        if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) {
          return existingByInn.get(r.counterparty_inn)!
        }
        if (!r.counterparty_name) return null
        const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
        return newCpKeyToId.get(key) || null
      }

      // ── 4. Filter duplicates: already-in-DB and duplicates within this file ──
      const candidateExternalIds = Array.from(new Set(
        activeRows.map(r => r.external_id).filter(Boolean) as string[]
      ))
      const existingExternalIds = new Set<string>()
      if (candidateExternalIds.length > 0) {
        const found = await txRepo.createQueryBuilder('t')
          .select(['t.external_id'])
          .where('t.bank_account_id = :acc', { acc: bank_account_id })
          .andWhere('t.external_id IN (:...ids)', { ids: candidateExternalIds })
          .getMany()
        for (const t of found) if (t.external_id) existingExternalIds.add(t.external_id)
      }

      const seenInBatch = new Set<string>()
      let dupSkipped = 0
      const rowsToInsert = activeRows.filter(r => {
        if (!r.external_id) return true
        const dupKey = `${bank_account_id}:${r.external_id}`
        if (existingExternalIds.has(r.external_id) || seenInBatch.has(dupKey)) {
          dupSkipped++
          return false
        }
        seenInBatch.add(dupKey)
        return true
      })

      // ── 5. Bulk-insert transactions in chunks of 100 ──
      const txPayloads = rowsToInsert.map(r => {
        const desc = (r.description || '').slice(0, 500)
        return {
          date: r.date,
          type: r.type,
          amount: r.amount,
          description: desc,
          source: 'import',
          counterparty_id: resolveCounterpartyId(r),
          category_id: r.category_id,
          bank_account_id,
          import_id: savedSession.id,
          external_id: r.external_id,
          raw_description: r.description,
          is_inter_account_transfer: r.is_transfer,
          linked_transfer_id: r.transfer_match_id || null,
        }
      })

      const insertedTxIds: string[] = []
      const CHUNK = 100
      for (let i = 0; i < txPayloads.length; i += CHUNK) {
        const chunk = txPayloads.slice(i, i + CHUNK)
        const result = await txRepo.insert(chunk as any[])
        for (const ident of result.identifiers) {
          insertedTxIds.push((ident as any).id)
        }
      }
      importedRows = insertedTxIds.length
      skipped += dupSkipped

      // ── 6. Backlink mirror transfer transactions (use rowsToInsert / insertedTxIds) ──
      const transferUpdates = rowsToInsert
        .map((r, idx) => ({ row: r, newId: insertedTxIds[idx] }))
        .filter(({ row, newId }) => row.is_transfer && row.transfer_match_id && newId)
      if (transferUpdates.length > 0) {
        await Promise.all(transferUpdates.map(({ row, newId }) =>
          txRepo.update(row.transfer_match_id!, {
            is_inter_account_transfer: true,
            linked_transfer_id: newId,
          } as any).then(() => transferLinks.push({ a: newId, b: row.transfer_match_id! }))
        ))
      }

      // ── 6. Bulk upsert learned rules ──
      const validRules = (rules_to_create || []).filter(r => r.match_value)
      if (validRules.length > 0) {
        const existing = await ruleRepo.find({ where: validRules.map(r => ({ match_type: r.match_type, match_value: r.match_value })) as any })
        const existingMap = new Map(existing.map(e => [`${e.match_type}:${e.match_value}`, e]))

        const toUpdate: ImportRule[] = []
        const toInsert: ImportRule[] = []
        for (const rule of validRules) {
          const key = `${rule.match_type}:${rule.match_value}`
          const ex = existingMap.get(key)
          if (ex) {
            ex.counterparty_id = rule.counterparty_id || ex.counterparty_id
            ex.category_id = rule.category_id || ex.category_id
            ex.is_inter_transfer = rule.is_inter_transfer || ex.is_inter_transfer
            ex.hit_count = (ex.hit_count || 0) + 1
            ex.last_used_at = new Date()
            toUpdate.push(ex)
          } else {
            toInsert.push(ruleRepo.create({ ...rule, hit_count: 1, last_used_at: new Date() } as any) as any)
          }
        }
        if (toInsert.length > 0) await ruleRepo.insert(toInsert)
        if (toUpdate.length > 0) await ruleRepo.save(toUpdate)
      }

      // Finalize session
      await importRepo.update(savedSession.id, {
        imported_rows: importedRows,
        skipped_duplicates: skipped,
        status: 'completed',
      } as any)

      res.json({
        import_id: savedSession.id,
        imported_rows: importedRows,
        skipped: skipped,
        transfer_links: transferLinks.length,
      })
    } catch (err: any) {
      console.error('[bankImport.commit]', err)
      res.status(500).json({ error: err.message || 'Ошибка импорта' })
    }
  },
}
