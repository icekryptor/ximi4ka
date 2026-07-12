import { Fragment, useMemo, useState } from 'react'
import type { SppDailyRow, SppOrderRow, DiscountPlatform } from '../../api/discountTracker'

/**
 * Фактическая СПП по заказам — дневной вид: артикулы вкладками, для активного —
 * таблица по дням (средняя СПП аккуратной плиткой + медиана, разброс, кол-во заказов,
 * ср. цена покупателя). Опциональный drill-down в распределение заказов за день.
 */

// Пороги как в сводной матрице: <33% красный, 33–36% жёлтый, >36% зелёный
const heatColor = (pctFraction: number): string => {
  const v = pctFraction * 100
  if (v < 33) return '#ef9a9a'
  if (v <= 36) return '#ffe082'
  return '#a5d6a7'
}

const pct = (v: number | null): string => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const money = (v: number | null): string =>
  v == null ? '—' : `${Math.round(v).toLocaleString('ru-RU')} ₽`
const dayLabel = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', weekday: 'short' })
}

const colKey = (p: DiscountPlatform, sku: string) => `${p}:${sku}`

interface Props {
  rows: SppDailyRow[]
  platform?: DiscountPlatform | 'all'
  /** admin: загрузка распределения заказов за день */
  loadOrders?: (platform: DiscountPlatform, sku: string, date: string) => Promise<SppOrderRow[]>
}

export const SppDailyView = ({ rows, platform = 'all', loadOrders }: Props) => {
  const data = useMemo(
    () => rows.filter((r) => platform === 'all' || r.platform === platform),
    [rows, platform],
  )

  const skus = useMemo(() => {
    const m = new Map<string, { ck: string; platform: DiscountPlatform; sku: string; name: string }>()
    for (const r of data) {
      const ck = colKey(r.platform, r.nm_id)
      if (!m.has(ck)) m.set(ck, { ck, platform: r.platform, sku: r.nm_id, name: r.product_name })
    }
    return [...m.values()].sort((a, b) => a.sku.localeCompare(b.sku))
  }, [data])

  const [active, setActive] = useState<string | null>(null)
  const activeCk = active && skus.some((s) => s.ck === active) ? active : skus[0]?.ck ?? null

  const days = useMemo(
    () =>
      data
        .filter((r) => colKey(r.platform, r.nm_id) === activeCk)
        .sort((a, b) => b.order_date.localeCompare(a.order_date)),
    [data, activeCk],
  )

  // drill-down
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [orders, setOrders] = useState<SppOrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const activeSku = skus.find((s) => s.ck === activeCk)

  const toggleDay = async (date: string) => {
    if (!loadOrders || !activeSku) return
    if (openDay === date) {
      setOpenDay(null)
      return
    }
    setOpenDay(date)
    setOrdersLoading(true)
    try {
      setOrders(await loadOrders(activeSku.platform, activeSku.sku, date))
    } finally {
      setOrdersLoading(false)
    }
  }

  if (!skus.length) {
    return (
      <p className="py-6 text-center text-sm text-brand-text-secondary">
        Данных по заказам пока нет — появятся после первой синхронизации.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Вкладки-артикулы */}
      <div className="flex flex-wrap gap-1.5">
        {skus.map((s) => (
          <button
            key={s.ck}
            type="button"
            onClick={() => {
              setActive(s.ck)
              setOpenDay(null)
            }}
            title={`${s.name} (${s.sku})`}
            className={`rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
              activeCk === s.ck
                ? 'bg-primary-500 text-white'
                : 'bg-muted text-brand-text-secondary hover:bg-brand-border/40'
            }`}
          >
            <span className="block font-mono font-semibold tabular-nums">{s.sku}</span>
            <span
              className={`block max-w-[160px] truncate text-[10px] font-normal ${
                activeCk === s.ck ? 'text-white/80' : 'text-brand-text-secondary/70'
              }`}
            >
              {s.name}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-left text-brand-text-secondary">
              <th className="py-2 pr-4 font-semibold whitespace-nowrap">Дата</th>
              <th className="py-2 pr-4 font-semibold text-right">Заказов</th>
              <th className="py-2 pr-4 font-semibold text-right">Средняя СПП</th>
              <th className="py-2 pr-4 font-semibold text-right">Медиана</th>
              <th className="py-2 pr-4 font-semibold text-right whitespace-nowrap">Разброс</th>
              <th className="py-2 font-semibold text-right whitespace-nowrap">Ср. цена покупателя</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const drillable = !!loadOrders
              return (
                <Fragment key={d.order_date}>
                  <tr
                    onClick={() => drillable && toggleDay(d.order_date)}
                    className={`border-b border-brand-border/50 ${
                      drillable ? 'cursor-pointer hover:bg-muted/40' : ''
                    }`}
                  >
                    <td className="py-1.5 pr-4 tabular-nums text-brand-text whitespace-nowrap">
                      {dayLabel(d.order_date)}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">
                      {d.orders_count}
                    </td>
                    <td className="py-1.5 pr-4 text-right">
                      <span
                        className="inline-flex min-w-[3.2rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ring-black/5"
                        style={{ backgroundColor: heatColor(d.avg_spp_pct ?? 0), color: '#1c1528' }}
                      >
                        {pct(d.avg_spp_pct)}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text">{pct(d.median_spp_pct)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary whitespace-nowrap">
                      {pct(d.min_spp_pct)} – {pct(d.max_spp_pct)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-brand-text">{money(d.avg_buyer_price)}</td>
                  </tr>
                  {openDay === d.order_date && (
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="px-4 py-3">
                        {ordersLoading ? (
                          <div className="text-xs text-brand-text-secondary">Загрузка заказов…</div>
                        ) : orders.length === 0 ? (
                          <div className="text-xs text-brand-text-secondary">Нет заказов за день</div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-brand-text-secondary">
                              Распределение по {orders.length} заказам ({dayLabel(d.order_date)}):
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {orders.map((o) => (
                                <span
                                  key={o.order_id}
                                  title={`${pct(o.spp_pct)} · покупатель ${money(o.buyer_price)} · продавец ${money(
                                    o.seller_price,
                                  )}${o.region ? ' · ' + o.region : ''}`}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset ring-black/5"
                                  style={{ backgroundColor: heatColor(o.spp_pct ?? 0), color: '#1c1528' }}
                                >
                                  {pct(o.spp_pct)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-xs text-brand-text-secondary">
        <span>СПП:</span>
        {[{ c: '#ef9a9a', t: '<33%' }, { c: '#ffe082', t: '33–36%' }, { c: '#a5d6a7', t: '>36%' }].map((x) => (
          <span key={x.t} className="flex items-center gap-1">
            <span className="inline-block h-4 w-6 rounded-md ring-1 ring-inset ring-black/5" style={{ backgroundColor: x.c }} />
            {x.t}
          </span>
        ))}
        <span>· Наведи на плитку заказа — цена покупателя/продавца и регион.</span>
      </div>
    </div>
  )
}
