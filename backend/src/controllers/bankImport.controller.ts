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

      for (const r of rows) {
        if (r.skip) { skipped++; continue }

        // Auto-create counterparty if name given but no FK
        let counterpartyId = r.counterparty_id
        if (!counterpartyId && r.counterparty_name) {
          const newCp = cpRepo.create({
            name: r.counterparty_name,
            inn: r.counterparty_inn || null,
          } as any)
          const savedCp = await cpRepo.save(newCp)
          counterpartyId = (savedCp as any).id
        }

        const desc = (r.description || '').slice(0, 500)
        const tx = txRepo.create({
          date: r.date,
          type: r.type,
          amount: r.amount,
          description: desc,
          source: 'import',
          counterparty_id: counterpartyId,
          category_id: r.category_id,
          bank_account_id,
          import_id: savedSession.id,
          external_id: r.external_id,
          raw_description: r.description,
          is_inter_account_transfer: r.is_transfer,
          linked_transfer_id: r.transfer_match_id || null,
        } as any)
        const savedTx = await txRepo.save(tx)
        importedRows++

        // If this row is a transfer matched against an existing tx, link both ways
        if (r.is_transfer && r.transfer_match_id) {
          await txRepo.update(r.transfer_match_id, {
            is_inter_account_transfer: true,
            linked_transfer_id: (savedTx as any).id,
          } as any)
          transferLinks.push({ a: (savedTx as any).id, b: r.transfer_match_id })
        }
      }

      // Persist learned rules (upsert by match_type + match_value)
      for (const rule of rules_to_create || []) {
        if (!rule.match_value) continue
        const existing = await ruleRepo.findOne({
          where: { match_type: rule.match_type, match_value: rule.match_value },
        })
        if (existing) {
          existing.counterparty_id = rule.counterparty_id || existing.counterparty_id
          existing.category_id = rule.category_id || existing.category_id
          existing.is_inter_transfer = rule.is_inter_transfer || existing.is_inter_transfer
          existing.hit_count = (existing.hit_count || 0) + 1
          existing.last_used_at = new Date()
          await ruleRepo.save(existing)
        } else {
          const created = ruleRepo.create({
            ...rule,
            hit_count: 1,
            last_used_at: new Date(),
          } as any)
          await ruleRepo.save(created)
        }
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
