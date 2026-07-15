import { apiClient } from './client'

export interface DashMetric {
  key: string
  label: string
  value: number | null
  unit: 'rub' | 'pct' | 'pcs' | 'x'
  sub?: { value: number; unit: 'rub' | 'pct' | 'pcs' } | null
  prev: number | null
  deltaPct: number | null
  goodWhen: 'up' | 'down'
  formula: string
  sources: string[]
  series?: Array<{ date: string; value: number }>
  note?: string
}

export interface WbDashboardData {
  range: { from: string; to: string }
  prevRange: { from: string; to: string }
  chart: Array<{ date: string; orders_sum: number; buyouts_sum: number }>
  metrics: DashMetric[]
  kb: Array<{ slug: string; title: string }>
  finance_fresh: boolean
  finance_to: string | null
  warnings: string[]
  generated_at: string
}

export const wbDashboardApi = {
  overview: async (params: { days?: number; from?: string; to?: string }): Promise<WbDashboardData> => {
    const r = await apiClient.get<WbDashboardData>('/dashboard/wb', { params })
    return r.data
  },
}
