export interface NormalizedRow {
  external_id: string | null
  date: string                     // ISO YYYY-MM-DD
  type: 'income' | 'expense'
  amount: number                   // positive
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  raw: Record<string, any>
}

export interface ParseResult {
  rows: NormalizedRow[]
  period_start: string | null
  period_end: string | null
  bank_code: 'tochka' | 'ozon'
  warnings: string[]
}

export type ParserFn = (buffer: Buffer) => ParseResult
