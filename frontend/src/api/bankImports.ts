import { apiClient as api } from './client'

export interface PreviewRow {
  index: number
  external_id: string | null
  date: string
  type: 'income' | 'expense'
  amount: number
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  suggested_counterparty_id: string | null
  suggested_counterparty_name: string | null
  suggested_category_id: string | null
  suggested_category_name: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
  matched_rule_id: string | null
  is_duplicate: boolean
  is_transfer: boolean
  transfer_match_id: string | null
}

export interface PreviewResponse {
  bank_code: 'tochka' | 'ozon'
  bank_account_id: string
  period_start: string | null
  period_end: string | null
  total_rows: number
  warnings: string[]
  rows: PreviewRow[]
}

export interface CommitRow {
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
  skip: boolean
}

export interface RuleToCreate {
  match_type: 'inn' | 'name_keyword' | 'description_keyword'
  match_value: string
  counterparty_id: string | null
  category_id: string | null
  is_inter_transfer: boolean
}

// Bank statement parsing/import can take a while on large files
const LONG_TIMEOUT = 180_000  // 3 minutes

export const bankImportsApi = {
  preview: (file: File, bankAccountId?: string): Promise<PreviewResponse> => {
    const fd = new FormData()
    fd.append('file', file)
    if (bankAccountId) fd.append('bank_account_id', bankAccountId)
    return api.post('/bank-imports/preview', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: LONG_TIMEOUT,
    }).then(r => r.data)
  },
  commit: (data: {
    bank_account_id: string
    file_name: string
    period_start: string | null
    period_end: string | null
    rows: CommitRow[]
    rules_to_create: RuleToCreate[]
  }): Promise<{ import_id: string; imported_rows: number; skipped: number; transfer_links: number }> =>
    api.post('/bank-imports/commit', data, { timeout: LONG_TIMEOUT }).then(r => r.data),
  autoCategorize: (rows: Array<{ index: number; counterparty_id: string | null; type: 'income' | 'expense' }>):
    Promise<{ suggestions: Array<{ index: number; category_id: string; category_name: string | null }> }> =>
    api.post('/bank-imports/auto-categorize', { rows }).then(r => r.data),
}
