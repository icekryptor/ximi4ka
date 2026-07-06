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

/** Ответ GET /public/spp/:token */
export interface PublicSppData {
  latest: PriceLatestRow[]
  hourly: PriceHourlyRow[]
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
  run: async (): Promise<DiscountRunResult> => {
    const r = await apiClient.post<DiscountRunResult>('/discount-tracker/run')
    return r.data
  },
}

/**
 * Публичный снимок для менеджера ВБ — bare fetch в обход axios-интерсептора
 * (иначе 401/403 дёрнул бы auto-logout и редирект на /login).
 * Бэкенд отдаёт 403 (не 401) на неверный токен, но подстрахуемся всё равно.
 */
export async function fetchPublicSpp(token: string, hours = 24 * 14): Promise<PublicSppData> {
  const base = import.meta.env.VITE_API_URL || '/api'
  const r = await fetch(`${base}/public/spp/${encodeURIComponent(token)}?hours=${hours}`, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    const msg = r.status === 403 ? 'Ссылка недействительна' : `Ошибка загрузки (${r.status})`
    throw new Error(msg)
  }
  return r.json()
}
