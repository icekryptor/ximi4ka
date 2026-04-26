import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankAccount } from '../entities/BankAccount'
import { Transaction } from '../entities/Transaction'
import { parse, detectBank, BankCode } from '../services/bank-parsers'
import { suggestMatch } from '../services/import-matcher'
import { detectTransfer } from '../services/transfer-detector'

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

  async commit(_req: Request, _res: Response): Promise<void> {
    // implemented in Task 3.4
  },
}
