import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { mpAnalyticsApi, MpAdRow, MpRange } from '../api/mpAnalytics'
import { useToast } from '../contexts/ToastContext'

const money = (v: number | null): string =>
  v == null ? '—' : `${Math.round(v).toLocaleString('ru-RU')} ₽`
const rub2 = (v: number | null): string => (v == null ? '—' : `${v.toFixed(2)} ₽`)
const int = (v: number | null): string => (v == null ? '—' : Math.round(v).toLocaleString('ru-RU'))
const pct = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`)
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

// ДРР-хитмап: <7 зелёный, 7–9 светло-зелёный, 9–12 жёлтый, >12 красный
const drrColor = (v: number | null): { bg: string; fg: string } => {
  if (v == null) return { bg: 'transparent', fg: 'inherit' }
  if (v < 7) return { bg: '#16a34a', fg: '#fff' }
  if (v < 9) return { bg: '#86efac', fg: '#14532d' }
  if (v < 12) return { bg: '#facc15', fg: '#422006' }
  return { bg: '#ef4444', fg: '#fff' }
}

const DrrCell = ({ v }: { v: number | null }) => {
  const c = drrColor(v)
  return (
    <span
      className="inline-flex min-w-[3.4rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ring-black/5"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {pct(v)}
    </span>
  )
}

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 400, label: 'Весь период' },
]

const monthRange = (ym: string): { from: string; to: string } => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

const MpAdsReport = () => {
  const toast = useToast()
  const [days, setDays] = useState(90)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [month, setMonth] = useState('')
  const useRange = !!(from && to)
  const periodLabel = useRange ? `${from} — ${to}` : `${days} дней`
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MpAdRow[]>([])

  const setPreset = (d: number) => {
    setDays(d)
    setFrom('')
    setTo('')
    setMonth('')
  }
  const setMonthPeriod = (ym: string) => {
    setMonth(ym)
    if (ym) {
      const r = monthRange(ym)
      setFrom(r.from)
      setTo(r.to)
    } else {
      setFrom('')
      setTo('')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const req: MpRange = from && to ? { from, to } : { days }
      setRows(await mpAnalyticsApi.ads('wb', req))
    } catch (err) {
      console.error('ads report load failed', err)
      toast.error('Не удалось загрузить отчёт по рекламе')
    } finally {
      setLoading(false)
    }
  }, [days, from, to, toast])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const t = { spend: 0, clicks: 0, orders_sum: 0, buyouts_sum: 0, cart: 0, orders_count: 0 }
    for (const r of rows) {
      t.spend += r.spend ?? 0
      t.clicks += r.clicks ?? 0
      t.orders_sum += r.orders_sum ?? 0
      t.buyouts_sum += r.buyouts_sum ?? 0
      t.cart += r.cart ?? 0
      t.orders_count += r.orders_count ?? 0
    }
    return t
  }, [rows])

  const div = (a: number, b: number) => (b ? a / b : null)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <Megaphone className="h-6 w-6 text-primary-500" />
        <h1 className="text-2xl font-bold text-brand-text">Реклама — ДРР</h1>
      </div>

      <div className="text-sm text-brand-text-secondary">
        Расход и клики — из рекламы WB; заказы/выкупы/корзины — из аналитики продаж. ДРР ={' '}
        расход ÷ выручка. Источник рекламы обновляется автосинком (сейчас данные за фев–март — WB API
        временно ограничен, дорастёт).
      </div>

      {/* Период */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPreset(p.days)}
            className={`px-3 py-2 rounded-xl text-sm font-medium ${!useRange && days === p.days ? 'bg-primary-500 text-white' : 'bg-card border border-brand-border text-brand-text-secondary'}`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonthPeriod(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary"
        />
        <div className="flex items-center gap-1">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setMonth('') }}
            className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
          <span className="text-brand-text-secondary/60">—</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setMonth('') }}
            className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
        </div>
      </div>

      {/* Легенда ДРР */}
      <div className="flex items-center gap-3 text-xs text-brand-text-secondary">
        <span>ДРР:</span>
        {[
          { c: '#16a34a', t: '<7%' },
          { c: '#86efac', t: '7–9%' },
          { c: '#facc15', t: '9–12%' },
          { c: '#ef4444', t: '>12%' },
        ].map((x) => (
          <span key={x.t} className="flex items-center gap-1">
            <span className="inline-block h-3.5 w-5 rounded ring-1 ring-inset ring-black/5" style={{ backgroundColor: x.c }} />
            {x.t}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card !p-10 text-center text-brand-text-secondary">
          Рекламных данных за период нет. Появятся, когда WB ads-синк догонит (сейчас есть фев–март 2026).
        </div>
      ) : (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">По дням ({periodLabel})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                  <th className="py-2 pr-4 font-semibold whitespace-nowrap">Дата</th>
                  <th className="py-2 pr-4 font-semibold text-right">Бюджет</th>
                  <th className="py-2 pr-4 font-semibold text-right">ДРРз</th>
                  <th className="py-2 pr-4 font-semibold text-right">ДРРв</th>
                  <th className="py-2 pr-4 font-semibold text-right">CPC</th>
                  <th className="py-2 pr-4 font-semibold text-right">Стоим. корзины</th>
                  <th className="py-2 pr-4 font-semibold text-right">Стоим. заказа</th>
                  <th className="py-2 font-semibold text-right">Клики</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-brand-border/70 font-semibold text-brand-text">
                  <td className="py-2 pr-4">Всего / средн.</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(totals.spend)}</td>
                  <td className="py-2 pr-4 text-right"><DrrCell v={div(totals.spend, totals.orders_sum) != null ? (totals.spend / totals.orders_sum) * 100 : null} /></td>
                  <td className="py-2 pr-4 text-right"><DrrCell v={totals.buyouts_sum ? (totals.spend / totals.buyouts_sum) * 100 : null} /></td>
                  <td className="py-2 pr-4 text-right tabular-nums">{rub2(div(totals.spend, totals.clicks))}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{rub2(div(totals.spend, totals.cart))}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{rub2(div(totals.spend, totals.orders_count))}</td>
                  <td className="py-2 text-right tabular-nums">{int(totals.clicks)}</td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.date} className="border-b border-brand-border/50">
                    <td className="py-1.5 pr-4 tabular-nums text-brand-text-secondary whitespace-nowrap">{dayLabel(r.date)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text">{money(r.spend)}</td>
                    <td className="py-1.5 pr-4 text-right"><DrrCell v={r.drr_orders} /></td>
                    <td className="py-1.5 pr-4 text-right"><DrrCell v={r.drr_buyouts} /></td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{rub2(r.cpc)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{rub2(r.cost_cart)}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{rub2(r.cost_order)}</td>
                    <td className="py-1.5 text-right tabular-nums text-brand-text-secondary">{int(r.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default MpAdsReport
