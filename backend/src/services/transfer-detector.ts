import { AppDataSource } from '../config/database'
import { Transaction } from '../entities/Transaction'
import { NormalizedRow } from './bank-parsers/types'
import { Between, Not } from 'typeorm'

export interface TransferMatch {
  matched_transaction_id: string
  matched_bank_account_id: string
}

/**
 * Look for a mirror transaction in the database that matches this row but
 * on a DIFFERENT bank account: same amount, opposite type, date ±2 days.
 */
export async function detectTransfer(
  row: NormalizedRow,
  importingAccountId: string,
): Promise<TransferMatch | null> {
  const txRepo = AppDataSource.getRepository(Transaction)

  const date = new Date(row.date)
  const from = new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const to   = new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const oppositeType = row.type === 'income' ? 'expense' : 'income'

  const candidates = await txRepo.find({
    where: {
      type: oppositeType as any,
      amount: row.amount as any,
      date: Between(from, to) as any,
      bank_account_id: Not(importingAccountId) as any,
      is_inter_account_transfer: false as any,
    },
    take: 5,
  })

  // Prefer the closest date
  if (candidates.length === 0) return null
  candidates.sort((a, b) =>
    Math.abs(new Date(a.date as any).getTime() - date.getTime()) -
    Math.abs(new Date(b.date as any).getTime() - date.getTime())
  )

  const match = candidates[0]
  return {
    matched_transaction_id: match.id,
    matched_bank_account_id: (match as any).bank_account_id,
  }
}
