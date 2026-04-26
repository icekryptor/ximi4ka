import { apiClient as api } from './client'

export interface PeriodBucket { start: string; end: string; label: string }
export interface CategoryRow {
  category_id: string | null
  name: string
  parent_id: string | null
  cashflow_section: 'operational' | 'investing' | 'financing' | null
  values: number[]
}
export interface CashflowReport {
  periods: PeriodBucket[]
  sections: Array<{
    code: 'operational' | 'investing' | 'financing'
    inflows: CategoryRow[]
    outflows: CategoryRow[]
    inflows_total: number[]
    outflows_total: number[]
    net: number[]
  }>
  unsorted_inflows: CategoryRow[]
  unsorted_outflows: CategoryRow[]
  opening_balance: number
  closing_balance: number
  net_cash_flow: number[]
}

export interface CashflowFilters {
  from: string
  to: string
  granularity: 'month' | 'week'
  accounts?: string[]
  counterparty_id?: string
  project_id?: string
  department_id?: string
}

export const cashflowApi = {
  report: (f: CashflowFilters): Promise<CashflowReport> => {
    const params: any = { from: f.from, to: f.to, granularity: f.granularity }
    if (f.accounts?.length) params.accounts = f.accounts.join(',')
    if (f.counterparty_id) params.counterparty_id = f.counterparty_id
    if (f.project_id) params.project_id = f.project_id
    if (f.department_id) params.department_id = f.department_id
    return api.get('/cashflow', { params }).then(r => r.data)
  },
}
