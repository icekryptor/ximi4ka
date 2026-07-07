import { apiClient } from './client'

export type MpPlatform = 'wb' | 'ozon'

export interface MpSummaryRow {
  sku: string
  product_name: string
  orders_sum: number | null
  orders_count: number | null
  buyouts_sum: number | null
  buyouts_count: number | null
  views: number | null
  share_pct: number | null
  orders_sum_prev: number | null
  orders_sum_delta: number | null
}

export interface MpDailyRow {
  platform: MpPlatform
  date: string
  sku: string
  product_name: string
  views: number | null
  cart: number | null
  orders_count: number | null
  orders_sum: number | null
  buyouts_count: number | null
  buyouts_sum: number | null
  cancels_count: number | null
  cart_conv: number | null
  order_conv: number | null
  buyout_percent: number | null
  avg_price: number | null
}

export interface MpRange {
  days?: number
  from?: string
  to?: string
}

export const mpAnalyticsApi = {
  summary: async (platform: MpPlatform = 'wb', range: MpRange = { days: 30 }): Promise<MpSummaryRow[]> => {
    const r = await apiClient.get<MpSummaryRow[]>('/mp-analytics/summary', { params: { platform, ...range } })
    return r.data
  },
  daily: async (platform: MpPlatform = 'wb', range: MpRange = { days: 30 }): Promise<MpDailyRow[]> => {
    const r = await apiClient.get<MpDailyRow[]>('/mp-analytics/daily', { params: { platform, ...range } })
    return r.data
  },
  sync: async (days = 30): Promise<{ ok: boolean; started: boolean }> => {
    const r = await apiClient.post('/mp-analytics/sync', { days })
    return r.data
  },
}
