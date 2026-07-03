import { apiClient } from './client'

export type DiscountPlatform = 'wb' | 'ozon'

/** Строка GET /discount-tracker/latest — последний снапшот по SKU + название товара */
export interface PriceLatestRow {
  platform: DiscountPlatform
  sku: string
  captured_at: string
  seller_price: number | null
  shelf_price: number | null
  platform_disc: number | null
  platform_pct: number | null
  discount_pct: number | null
  product_name: string
}

/** Строка GET /discount-tracker/history — снапшот из price_snapshots (asc по времени) */
export interface PriceHistoryRow {
  captured_at: string
  platform: DiscountPlatform
  sku: string
  seller_price: number | null
  shelf_price: number | null
  own_discount: number | null
  platform_disc: number | null
  discount_pct: number | null
  platform_pct: number | null
}

/** Строка GET /discount-tracker/alerts — alert_state с непустым last_alerted */
export interface DiscountAlertRow {
  platform: DiscountPlatform
  sku: string
  last_pct: number | null
  last_alerted: string
}

/** Ответ POST /discount-tracker/run */
export interface DiscountRunResult {
  ok: true
  snapshots: number
  alerts: number
}

export const discountTrackerApi = {
  latest: async (): Promise<PriceLatestRow[]> => {
    const r = await apiClient.get<PriceLatestRow[]>('/discount-tracker/latest')
    return r.data
  },
  history: async (
    platform: DiscountPlatform,
    sku: string,
    hours = 48,
  ): Promise<PriceHistoryRow[]> => {
    const r = await apiClient.get<PriceHistoryRow[]>('/discount-tracker/history', {
      params: { platform, sku, hours },
    })
    return r.data
  },
  alerts: async (): Promise<DiscountAlertRow[]> => {
    const r = await apiClient.get<DiscountAlertRow[]>('/discount-tracker/alerts')
    return r.data
  },
  run: async (): Promise<DiscountRunResult> => {
    const r = await apiClient.post<DiscountRunResult>('/discount-tracker/run')
    return r.data
  },
}
