import { Fragment, useEffect, useMemo, useState } from 'react'
import { mpAnalyticsApi, MpAdDetailRow, MpRange } from '../../api/mpAnalytics'

// Поиск = au+cpc, Полки = apk
const SEARCH = new Set(['au', 'cpc'])
const isSearch = (src: string) => SEARCH.has(src)

type Src = { impr: number; clicks: number; spend: number; carts: number; orders: number }
const zeroSrc = (): Src => ({ impr: 0, clicks: 0, spend: 0, carts: 0, orders: 0 })
const addSrc = (a: Src, r: MpAdDetailRow) => {
  a.impr += r.impressions ?? 0; a.clicks += r.clicks ?? 0; a.spend += r.spend ?? 0
  a.carts += r.carts ?? 0; a.orders += r.orders ?? 0
}
type Cell = { total: Src; search: Src; shelf: Src }
const zeroCell = (): Cell => ({ total: zeroSrc(), search: zeroSrc(), shelf: zeroSrc() })

const int = (v: number) => Math.round(v).toLocaleString('ru-RU')
const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')}`
const rub = (a: number, b: number) => (b ? (a / b).toFixed(1) : '—')
const pctr = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')

// метрики: (Src) → строка. Для «Всего/Поиск/Полки» применяем к total/search/shelf
const METRICS: Array<{ key: string; label: string; fn: (s: Src) => string }> = [
  { key: 'budget', label: 'Бюджет', fn: (s) => money(s.spend) },
  { key: 'impr', label: 'Показы', fn: (s) => int(s.impr) },
  { key: 'clicks', label: 'Клики', fn: (s) => int(s.clicks) },
  { key: 'ctr', label: 'CTR%', fn: (s) => pctr(s.clicks, s.impr) },
  { key: 'cpm', label: 'CPM', fn: (s) => (s.impr ? ((s.spend / s.impr) * 1000).toFixed(0) : '—') },
  { key: 'cpc', label: 'CPC', fn: (s) => rub(s.spend, s.clicks) },
  { key: 'carts', label: 'Корзины', fn: (s) => int(s.carts) },
  { key: 'cart_conv', label: 'Конв.в корзину', fn: (s) => pctr(s.carts, s.clicks) },
  { key: 'orders', label: 'Заказы', fn: (s) => int(s.orders) },
  { key: 'order_conv', label: 'Конв.в заказ', fn: (s) => pctr(s.orders, s.carts) },
  { key: 'cr', label: 'CR% (клики→заказы)', fn: (s) => pctr(s.orders, s.clicks) },
]
const SUBROWS: Array<{ pick: (c: Cell) => Src; label: string }> = [
  { pick: (c) => c.total, label: 'Всего' },
  { pick: (c) => c.search, label: 'Поиск' },
  { pick: (c) => c.shelf, label: 'Полки' },
]

const weekStart = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

interface Props {
  range: MpRange
  gran: 'day' | 'week'
}

export const PromoDigits = ({ range, gran }: Props) => {
  const [rows, setRows] = useState<MpAdDetailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSku, setActiveSku] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    mpAnalyticsApi
      .adsDetail('wb', range)
      .then((d) => { if (alive) setRows(d) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range.days, range.from, range.to])

  const today = new Date().toISOString().slice(0, 10)

  const skus = useMemo(() => {
    const m = new Map<string, { article: string; name: string }>()
    for (const r of rows) if (!m.has(r.sku)) m.set(r.sku, { article: r.seller_article || r.sku, name: r.product_name })
    return [...m.entries()].map(([sku, v]) => ({ sku, ...v })).sort((a, b) => a.article.localeCompare(b.article))
  }, [rows])

  const curSku = activeSku && skus.some((s) => s.sku === activeSku) ? activeSku : skus[0]?.sku ?? null

  const { buckets, grid } = useMemo(() => {
    const grid = new Map<string, Cell>() // bucket → Cell
    for (const r of rows) {
      const iso = r.date.slice(0, 10)
      if (iso >= today || r.sku !== curSku) continue
      const key = gran === 'week' ? weekStart(iso) : iso
      if (!grid.has(key)) grid.set(key, zeroCell())
      const c = grid.get(key)!
      addSrc(c.total, r)
      addSrc(isSearch(r.source) ? c.search : c.shelf, r)
    }
    const buckets = [...grid.keys()].sort((a, b) => b.localeCompare(a))
    return { buckets, grid }
  }, [rows, curSku, gran, today])

  const bucketLabel = (key: string) =>
    gran === 'week'
      ? `${dayLabel(key)}–${dayLabel(new Date(new Date(key + 'T00:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10))}`
      : dayLabel(key)

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin h-7 w-7 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
  if (!skus.length) return <div className="card !p-10 text-center text-brand-text-secondary">Рекламных данных за период нет.</div>

  return (
    <div className="card space-y-3">
      {/* Вкладки-артикулы */}
      <div className="flex flex-wrap gap-1.5">
        {skus.map((s) => (
          <button key={s.sku} onClick={() => setActiveSku(s.sku)} title={s.name}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs ${curSku === s.sku ? 'bg-primary-500 text-white' : 'bg-muted text-brand-text-secondary'}`}>
            {s.article}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead>
            <tr className="border-b border-brand-border text-brand-text-secondary">
              <th className="py-1.5 pr-2 text-left font-semibold sticky left-0 bg-card" colSpan={2}>Метрика</th>
              {buckets.map((b) => (
                <th key={b} className="py-1.5 px-1.5 text-right font-semibold whitespace-nowrap">{bucketLabel(b)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <Fragment key={m.key}>
                {SUBROWS.map((sub, i) => (
                  <tr key={m.key + i} className={`border-b border-brand-border/40 ${i === 0 ? 'border-t border-brand-border/70' : ''}`}>
                    {i === 0 && (
                      <td rowSpan={3} className="py-1 pr-2 align-top font-semibold text-brand-text whitespace-nowrap sticky left-0 bg-card">{m.label}</td>
                    )}
                    <td className={`py-0.5 pr-2 whitespace-nowrap sticky left-[68px] bg-card ${i === 0 ? 'text-brand-text' : 'text-brand-text-secondary/70'}`}>{sub.label}</td>
                    {buckets.map((b) => (
                      <td key={b} className={`py-0.5 px-1.5 text-right tabular-nums ${i === 0 ? 'text-brand-text font-medium' : 'text-brand-text-secondary'}`}>
                        {m.fn(sub.pick(grid.get(b)!))}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-brand-text-secondary/70">Поиск = аукцион + cpc · Полки = авто-АРК. Столбцы — {gran === 'week' ? 'недели' : 'дни'}.</p>
    </div>
  )
}
