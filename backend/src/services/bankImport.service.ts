import { AppDataSource } from '../config/database'
import { BankImport } from '../entities/BankImport'
import { Transaction, TransactionSource, TransactionType } from '../entities/Transaction'
import { Counterparty } from '../entities/Counterparty'
import { ImportRule } from '../entities/ImportRule'
import type { NormalizedRow } from './bank-parsers/types'

export interface CommitNormalizedRowsInput {
  bank_account_id: string
  rows: NormalizedRow[]
  file_name: string                       // 'tochka-sync-2026-05-18' or similar synthetic name
  period_start: string | null
  period_end: string | null
  imported_by: string | null
  /** If true — rows without an ImportRule match are flagged needs_review=true. */
  flag_unmatched_for_review: boolean
}

export interface CommitNormalizedRowsResult {
  import_id: string
  rows_imported: number
  rows_skipped_dup: number
  rows_pending_review: number
}

export const bankImportService = {
  /**
   * Common import path used by both manual file upload (controller) and
   * auto-sync (BankSyncService). Idempotent via Transaction.external_id —
   * duplicates are silently skipped.
   *
   * When flag_unmatched_for_review=true (auto-sync case), transactions with
   * no matching ImportRule get `needs_review = true` so they surface in the
   * Cashflow «Требуют категоризации» queue.
   */
  async commitNormalized(input: CommitNormalizedRowsInput): Promise<CommitNormalizedRowsResult> {
    const importRepo = AppDataSource.getRepository(BankImport)
    const txRepo = AppDataSource.getRepository(Transaction)
    const cpRepo = AppDataSource.getRepository(Counterparty)
    const ruleRepo = AppDataSource.getRepository(ImportRule)

    const session = importRepo.create({
      bank_account_id: input.bank_account_id,
      file_name: input.file_name,
      period_start: input.period_start,
      period_end: input.period_end,
      total_rows: input.rows.length,
      imported_rows: 0,
      skipped_duplicates: 0,
      status: 'pending',
      imported_by: input.imported_by,
    })
    const savedSession = await importRepo.save(session)

    // 1. Resolve counterparties: bulk-fetch existing by INN, prepare new ones.
    const innsToLookup = Array.from(new Set(
      input.rows.filter((r) => r.counterparty_inn).map((r) => r.counterparty_inn!),
    ))
    const existingByInn = new Map<string, string>()
    if (innsToLookup.length > 0) {
      const found = await cpRepo.createQueryBuilder('cp')
        .select(['cp.id', 'cp.inn'])
        .where('cp.inn IN (:...inns)', { inns: innsToLookup })
        .getMany()
      found.forEach((cp) => existingByInn.set((cp as any).inn, cp.id))
    }

    type NewCp = { key: string; name: string; inn: string | null }
    const newCpMap = new Map<string, NewCp>()
    for (const r of input.rows) {
      if (!r.counterparty_name) continue
      if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) continue
      const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
      if (!newCpMap.has(key)) {
        newCpMap.set(key, { key, name: r.counterparty_name, inn: r.counterparty_inn || null })
      }
    }
    const newCpKeyToId = new Map<string, string>()
    if (newCpMap.size > 0) {
      const newCpList = Array.from(newCpMap.values())
      const insertResult = await cpRepo.insert(
        newCpList.map((cp) => ({ name: cp.name, inn: cp.inn })) as any[],
      )
      newCpList.forEach((cp, idx) => {
        newCpKeyToId.set(cp.key, (insertResult.identifiers[idx] as any).id)
      })
    }

    const resolveCounterpartyId = (r: NormalizedRow): string | null => {
      if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) {
        return existingByInn.get(r.counterparty_inn)!
      }
      if (!r.counterparty_name) return null
      const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
      return newCpKeyToId.get(key) || null
    }

    // 2. Load ImportRules for auto-categorization.
    const rules = await ruleRepo.find()
    const matchRule = (r: NormalizedRow): { category_id: string | null; counterparty_id: string | null; is_transfer: boolean } | null => {
      for (const rule of rules) {
        if (rule.match_type === 'inn' && r.counterparty_inn === rule.match_value) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
        if (rule.match_type === 'name_keyword' && r.counterparty_name?.toLowerCase().includes(rule.match_value.toLowerCase())) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
        if (rule.match_type === 'description_keyword' && r.description?.toLowerCase().includes(rule.match_value.toLowerCase())) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
      }
      return null
    }

    // 3. Check existing transactions by external_id for dedup.
    const externalIds = input.rows.map((r) => r.external_id).filter((x): x is string => !!x)
    const existingExternalIds = new Set<string>()
    if (externalIds.length > 0) {
      const found = await txRepo.createQueryBuilder('t')
        .select('t.external_id')
        .where('t.external_id IN (:...ids)', { ids: externalIds })
        .andWhere('t.bank_account_id = :bid', { bid: input.bank_account_id })
        .getMany()
      found.forEach((t) => t.external_id && existingExternalIds.add(t.external_id))
    }

    // 4. Build transactions to insert.
    let importedRows = 0
    let skippedDup = 0
    let pendingReview = 0
    const txsToInsert: any[] = []

    for (const r of input.rows) {
      if (r.external_id && existingExternalIds.has(r.external_id)) {
        skippedDup++
        continue
      }
      const rule = matchRule(r)
      const counterpartyId = rule?.counterparty_id || resolveCounterpartyId(r)
      const categoryId = rule?.category_id || null
      const needsReview = input.flag_unmatched_for_review && !rule

      txsToInsert.push({
        type: r.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
        amount: r.amount,
        description: r.description || r.counterparty_name || '(без описания)',
        date: new Date(r.date),
        category_id: categoryId,
        counterparty_id: counterpartyId,
        document_number: typeof r.raw === 'object' && r.raw && 'documentNumber' in (r.raw as any)
          ? String((r.raw as any).documentNumber || '')
          : null,
        source: TransactionSource.IMPORT,
        bank_account_id: input.bank_account_id,
        import_id: savedSession.id,
        external_id: r.external_id,
        raw_description: r.description,
        is_inter_account_transfer: rule?.is_transfer || false,
        needs_review: needsReview,
      })

      importedRows++
      if (needsReview) pendingReview++
    }

    if (txsToInsert.length > 0) {
      await txRepo.insert(txsToInsert as any[])
    }

    await importRepo.update(savedSession.id, {
      imported_rows: importedRows,
      skipped_duplicates: skippedDup,
      status: 'completed',
    })

    return {
      import_id: savedSession.id,
      rows_imported: importedRows,
      rows_skipped_dup: skippedDup,
      rows_pending_review: pendingReview,
    }
  },
}
