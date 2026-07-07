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

/** Строка GET /discount-tracker/hourly — почасовое среднее по (platform, sku, час) */
export interface PriceHourlyRow {
  platform: DiscountPlatform
  sku: string
  hour: string
  avg_platform_pct: number | null
  avg_discount_pct: number | null
  avg_shelf_price: number | null
  avg_seller_price: number | null
  samples: number
  product_name: string
}

/** Строка GET /discount-tracker/spp/daily — дневной агрегат фактической СПП по заказам */
export interface SppDailyRow {
  platform: DiscountPlatform
  nm_id: string
  order_date: string
  orders_count: number
  avg_spp_pct: number | null
  median_spp_pct: number | null
  min_spp_pct: number | null
  max_spp_pct: number | null
  avg_buyer_price: number | null
  avg_seller_price: number | null
  product_name: string
}

/** Строка GET /discount-tracker/spp/orders — заказ (распределение) */
export interface SppOrderRow {
  order_id: string
  order_date: string
  seller_price: number | null
  buyer_price: number | null
  spp_pct: number | null
  region: string | null
  is_cancel: boolean
}

/** Ответ GET /public/spp/:token — дневная фактическая СПП, только WB */
export interface PublicSppData {
  daily: SppDailyRow[]
  generated_at: string
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
  hourly: async (hours = 24): Promise<PriceHourlyRow[]> => {
    const r = await apiClient.get<PriceHourlyRow[]>('/discount-tracker/hourly', {
      params: { hours },
    })
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
  // Фактическая СПП по заказам (основной источник)
  sppDaily: async (platform?: DiscountPlatform, days = 30): Promise<SppDailyRow[]> => {
    const r = await apiClient.get<SppDailyRow[]>('/discount-tracker/spp/daily', {
      params: { ...(platform ? { platform } : {}), days },
    })
    return r.data
  },
  sppOrders: async (platform: DiscountPlatform, sku: string, date: string): Promise<SppOrderRow[]> => {
    const r = await apiClient.get<SppOrderRow[]>('/discount-tracker/spp/orders', {
      params: { platform, sku, date },
    })
    return r.data
  },
  sppSync: async (days = 14): Promise<{ ok: boolean; fetched: number; upserted: number }> => {
    const r = await apiClient.post('/discount-tracker/spp/sync', { days })
    return r.data
  },
}

/**
 * Публичный снимок для менеджера ВБ — bare fetch в обход axios-интерсептора
 * (иначе 401/403 дёрнул бы auto-logout и редирект на /login).
 * Бэкенд отдаёт 403 (не 401) на неверный токен, но подстрахуемся всё равно.
 */
export async function fetchPublicSpp(token: string, days = 30): Promise<PublicSppData> {
  const base = import.meta.env.VITE_API_URL || '/api'
  const r = await fetch(`${base}/public/spp/${encodeURIComponent(token)}?days=${days}`, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    const msg = r.status === 403 ? 'Ссылка недействительна' : `Ошибка загрузки (${r.status})`
    throw new Error(msg)
  }
  return r.json()
}
