import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, Table2, Grid3x3, Plus, Minus } from 'lucide-react'
import { mpAnalyticsApi, MpAdRow, MpRange } from '../api/mpAnalytics'
import { useToast } from '../contexts/ToastContext'

// ── форматтеры ──
const money = (v: number): string => `${Math.round(v).toLocaleString('ru-RU')} ₽`
const int = (v: number): string => Math.round(v).toLocaleString('ru-RU')
const pct = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`)
const x2 = (v: number | null): string => (v == null ? '—' : v.toFixed(2))
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

// ── ДРР-хитмап цвета: <7 зелёный, 7–9 светло-зелёный, 9–12 жёлтый, >12 красный ──
// приглушённая палитра — мягче для восприятия
const drrColor = (v: number | null): { bg: string; fg: string } => {
  if (v == null) return { bg: 'transparent', fg: 'inherit' }
  if (v < 7) return { bg: '#a5d6a7', fg: '#1b5e20' }   // приглушённый зелёный
  if (v < 9) return { bg: '#d0e8c4', fg: '#33691e' }   // светло-зелёный
  if (v < 12) return { bg: '#ffe082', fg: '#5c4400' }  // мягкий жёлтый
  return { bg: '#ef9a9a', fg: '#7f1d1d' }              // мягкий красный
}
const DrrCell = ({ v }: { v: number | null }) => {
  const c = drrColor(v)
  return (
    <span className="inline-flex min-w-[2.4rem] items-center justify-center rounded px-1 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ring-black/5"
      style={{ backgroundColor: c.bg, color: c.fg }}>{pct(v)}</span>
  )
}

// сумма метрик
type Agg = {
  impressions: number; clicks: number; spend: number; carts_ad: number; orders_ad: number; orders_sum_ad: number
  cart: number; orders_count: number; orders_sum: number; buyouts_count: number; buyouts_sum: number
}
const zero = (): Agg => ({ impressions: 0, clicks: 0, spend: 0, carts_ad: 0, orders_ad: 0, orders_sum_ad: 0, cart: 0, orders_count: 0, orders_sum: 0, buyouts_count: 0, buyouts_sum: 0 })
const add = (a: Agg, r: MpAdRow) => {
  a.impressions += r.impressions ?? 0; a.clicks += r.clicks ?? 0; a.spend += r.spend ?? 0
  a.carts_ad += r.carts_ad ?? 0; a.orders_ad += r.orders_ad ?? 0; a.orders_sum_ad += r.orders_sum_ad ?? 0
  a.cart += r.cart ?? 0; a.orders_count += r.orders_count ?? 0; a.orders_sum += r.orders_sum ?? 0
  a.buyouts_count += r.buyouts_count ?? 0; a.buyouts_sum += r.buyouts_sum ?? 0
}
const ratio = (a: number, b: number): number | null => (b ? (a / b) * 100 : null)
const drr = (spend: number, rev: number): number | null => (rev ? (spend / rev) * 100 : null)

const PERIODS = [
  { days: 7, label: '7 дней' }, { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' }, { days: 400, label: 'Весь период' },
]
const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

// колонки метрик (день/артикул). group — для группировки/подсветки шапки
const METRICS: Array<{ key: string; label: string }> = [
  { key: 'spend', label: 'Расход' },
  { key: 'impressions', label: 'Показы' },
  { key: 'clicks', label: 'Клики' },
  { key: 'ctr', label: 'CTR' },
  { key: 'carts_ad', label: 'Корз' },
  { key: 'cart_conv', label: 'вКорз' },
  { key: 'cr', label: 'CR' },
  { key: 'orders_total', label: 'Зак.всего' },
  { key: 'orders_ad', label: 'Зак.РК' },
  { key: 'orders_organic', label: 'Зак.орг' },
  { key: 'ad_share', label: 'Доля РК' },
  { key: 'buyout_pct', label: '%вык' },
  { key: 'orders_sum', label: 'Выр.всего' },
  { key: 'rev_ad', label: 'Выр.РК' },
  { key: 'rev_organic', label: 'Выр.орг' },
  { key: 'buyouts_sum', label: 'Выкупы₽' },
  { key: 'drrz', label: 'ДРРз' },
  { key: 'drrv', label: 'ДРРв' },
  { key: 'roas', label: 'ROAS' },
]
// колонки-доли, которые красим (доля рекламы в заказах)
const share = (ad: number, tot: number): number | null => (tot ? (ad / tot) * 100 : null)

const cellFor = (key: string, a: Agg) => {
  const orgOrders = Math.max(0, a.orders_count - a.orders_ad)
  const orgRev = Math.max(0, a.orders_sum - a.orders_sum_ad)
  switch (key) {
    case 'spend': return money(a.spend)
    case 'impressions': return int(a.impressions)
    case 'clicks': return int(a.clicks)
    case 'ctr': return pct(ratio(a.clicks, a.impressions))
    case 'carts_ad': return int(a.carts_ad)
    case 'cart_conv': return pct(ratio(a.carts_ad, a.clicks))
    case 'cr': return pct(ratio(a.orders_ad, a.clicks))
    case 'orders_total': return int(a.orders_count)
    case 'orders_ad': return int(a.orders_ad)
    case 'orders_organic': return int(orgOrders)
    case 'buyout_pct': return pct(ratio(a.buyouts_count, a.orders_count))
    case 'orders_sum': return money(a.orders_sum)
    case 'rev_ad': return money(a.orders_sum_ad)
    case 'rev_organic': return money(orgRev)
    case 'buyouts_sum': return money(a.buyouts_sum)
    case 'roas': return x2(a.spend ? a.orders_sum / a.spend : null)
    default: return ''
  }
}

const renderCell = (key: string, a: Agg) => {
  if (key === 'drrz') return <DrrCell v={drr(a.spend, a.orders_sum)} />
  if (key === 'drrv') return <DrrCell v={drr(a.spend, a.buyouts_sum)} />
  if (key === 'ad_share') return <span className="font-semibold text-brand-text">{pct(share(a.orders_ad, a.orders_count))}</span>
  return cellFor(key, a)
}

const MpAdsReport = () => {
  const toast = useToast()
  const [days, setDays] = useState(30)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [month, setMonth] = useState('')
  const [view, setView] = useState<'table' | 'heatmap'>('table')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MpAdRow[]>([])
  const useRange = !!(from && to)

  const setPreset = (d: number) => { setDays(d); setFrom(''); setTo(''); setMonth('') }
  const setMonthPeriod = (ym: string) => {
    setMonth(ym)
    if (ym) { const r = monthRange(ym); setFrom(r.from); setTo(r.to) } else { setFrom(''); setTo('') }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const req: MpRange = from && to ? { from, to } : { days }
      setRows(await mpAnalyticsApi.ads('wb', req))
    } catch (err) {
      console.error('ads report load failed', err)
      toast.error('Не удалось загрузить отчёт по рекламе')
    } finally { setLoading(false) }
  }, [days, from, to, toast])
  useEffect(() => { load() }, [load])

  // агрегаты по дням + по (день, артикул)
  const { dates, byDay, byDaySku, skus } = useMemo(() => {
    const byDay = new Map<string, Agg>()
    const byDaySku = new Map<string, Map<string, Agg>>()
    const skuMeta = new Map<string, { name: string; article: string }>()
    for (const r of rows) {
      const d = r.date.slice(0, 10)
      if (!byDay.has(d)) byDay.set(d, zero())
      add(byDay.get(d)!, r)
      if (!byDaySku.has(d)) byDaySku.set(d, new Map())
      const m = byDaySku.get(d)!
      if (!m.has(r.sku)) m.set(r.sku, zero())
      add(m.get(r.sku)!, r)
      if (!skuMeta.has(r.sku)) skuMeta.set(r.sku, { name: r.product_name, article: r.seller_article || r.sku })
    }
    const dates = [...byDay.keys()].sort((a, b) => b.localeCompare(a))
    const skus = [...skuMeta.entries()]
      .map(([sku, meta]) => ({ sku, name: meta.name, article: meta.article }))
      .sort((a, b) => a.article.localeCompare(b.article))
    return { dates, byDay, byDaySku, skus }
  }, [rows])

  const toggle = (d: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })

  const periodLabel = useRange ? `${from} — ${to}` : `${days} дней`

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Megaphone className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Реклама</h1>
        </div>
        <div className="flex gap-1 rounded-xl border border-brand-border p-0.5">
          <button onClick={() => setView('table')} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'table' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
            <Table2 className="h-4 w-4" /> Таблица
          </button>
          <button onClick={() => setView('heatmap')} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'heatmap' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
            <Grid3x3 className="h-4 w-4" /> Хитмап ДРР
          </button>
        </div>
      </div>

      {/* Период */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button key={p.days} onClick={() => setPreset(p.days)}
            className={`px-3 py-2 rounded-xl text-sm font-medium ${!useRange && days === p.days ? 'bg-primary-500 text-white' : 'bg-card border border-brand-border text-brand-text-secondary'}`}>{p.label}</button>
        ))}
        <input type="month" value={month} onChange={(e) => setMonthPeriod(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
        <div className="flex items-center gap-1">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setMonth('') }} className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
          <span className="text-brand-text-secondary/60">—</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setMonth('') }} className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
        </div>
      </div>

      {/* Легенда ДРР */}
      <div className="flex items-center gap-3 text-xs text-brand-text-secondary">
        <span>ДРР:</span>
        {[{ c: '#a5d6a7', t: '<7%' }, { c: '#d0e8c4', t: '7–9%' }, { c: '#ffe082', t: '9–12%' }, { c: '#ef9a9a', t: '>12%' }].map((x) => (
          <span key={x.t} className="flex items-center gap-1"><span className="inline-block h-3.5 w-5 rounded ring-1 ring-inset ring-black/5" style={{ backgroundColor: x.c }} />{x.t}</span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
      ) : dates.length === 0 ? (
        <div className="card !p-10 text-center text-brand-text-secondary">Рекламных данных за период нет.</div>
      ) : view === 'table' ? (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">По дням ({periodLabel}) — жми [+] для разбивки по артикулам</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                  <th className="py-1.5 pr-2 font-semibold whitespace-nowrap sticky left-0 bg-card">Дата</th>
                  {METRICS.map((m) => (<th key={m.key} className="py-1.5 px-1.5 font-semibold text-right whitespace-nowrap">{m.label}</th>))}
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => {
                  const a = byDay.get(d)!
                  const isOpen = expanded.has(d)
                  const arts = byDaySku.get(d)!
                  return (
                    <Fragment key={d}>
                      <tr className="border-b border-brand-border/60 hover:bg-muted/30 cursor-pointer" onClick={() => toggle(d)}>
                        <td className="py-1 pr-2 font-medium text-brand-text whitespace-nowrap sticky left-0 bg-card">
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-brand-border text-brand-text-secondary">
                              {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </span>
                            {dayLabel(d)}
                          </span>
                        </td>
                        {METRICS.map((m) => (
                          <td key={m.key} className="py-1 px-1.5 text-right tabular-nums text-brand-text">
                            {renderCell(m.key, a)}
                          </td>
                        ))}
                      </tr>
                      {isOpen && [...arts.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([sku, sa]) => (
                        <tr key={d + sku} className="border-b border-brand-border/30 bg-muted/20 text-brand-text-secondary">
                          <td className="py-0.5 pr-2 pl-7 whitespace-nowrap sticky left-0 bg-muted/20">
                            <span className="font-mono align-middle" title={skus.find(s => s.sku === sku)?.name}>{skus.find(s => s.sku === sku)?.article ?? sku}</span>
                          </td>
                          {METRICS.map((m) => (
                            <td key={m.key} className="py-0.5 px-1.5 text-right tabular-nums">
                              {renderCell(m.key, sa)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
                {/* Всего за период */}
                {(() => {
                  const g = zero()
                  for (const d of dates) { const a = byDay.get(d)!; (Object.keys(g) as (keyof Agg)[]).forEach((k) => { g[k] += a[k] }) }
                  return (
                    <tr className="border-t-2 border-brand-border font-semibold text-brand-text">
                      <td className="py-1.5 pr-2 whitespace-nowrap sticky left-0 bg-card">Всего</td>
                      {METRICS.map((m) => (<td key={m.key} className="py-1.5 px-1.5 text-right tabular-nums">{renderCell(m.key, g)}</td>))}
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ── Хитмап ДРР: строки — артикулы, столбцы — даты (свежие справа), низ — средний ДРР + бюджет ──
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">Хитмап ДРРз — артикулы × дни</h2>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="flex">
                <div className="w-44 shrink-0" />
                <div className="flex gap-1">
                  {[...dates].reverse().map((d) => (
                    <div key={d} className="w-16 shrink-0 text-center text-[10px] text-brand-text-secondary/80">{dayLabel(d)}</div>
                  ))}
                </div>
              </div>
              <div className="mt-1 space-y-1">
                {skus.map((s) => (
                  <div key={s.sku} className="flex items-center">
                    <div className="w-44 shrink-0 pr-2 truncate font-mono text-xs text-brand-text" title={s.name}>{s.article}</div>
                    <div className="flex gap-1">
                      {[...dates].reverse().map((d) => {
                        const sa = byDaySku.get(d)?.get(s.sku)
                        const v = sa ? drr(sa.spend, sa.orders_sum) : null
                        const c = drrColor(v)
                        return (
                          <div key={d} className="flex h-9 w-16 shrink-0 flex-col items-center justify-center rounded-md tabular-nums ring-1 ring-inset ring-black/5"
                            style={{ backgroundColor: c.bg === 'transparent' ? '#f4f2f8' : c.bg, color: c.bg === 'transparent' ? '#b3adc0' : c.fg }}
                            title={sa ? `${s.name} · ${dayLabel(d)} · ДРРз ${pct(v)} · бюджет ${money(sa.spend)}` : 'нет'}>
                            <span className="text-[10px] font-semibold">{v == null ? '·' : pct(v)}</span>
                            {sa && sa.spend > 0 && <span className="text-[8px] opacity-70">{int(sa.spend)}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {/* нижняя строка: средний ДРР по дню + дневной бюджет */}
                <div className="flex items-center pt-1 border-t border-brand-border">
                  <div className="w-44 shrink-0 pr-2 text-xs font-semibold text-brand-text">Средний ДРР / бюджет</div>
                  <div className="flex gap-1">
                    {[...dates].reverse().map((d) => {
                      const a = byDay.get(d)!
                      const v = drr(a.spend, a.orders_sum)
                      const c = drrColor(v)
                      return (
                        <div key={d} className="flex h-9 w-16 shrink-0 flex-col items-center justify-center rounded-md font-semibold ring-1 ring-inset ring-black/5"
                          style={{ backgroundColor: c.bg === 'transparent' ? '#f4f2f8' : c.bg, color: c.bg === 'transparent' ? '#b3adc0' : c.fg }}
                          title={`${dayLabel(d)} · средний ДРРз ${pct(v)} · бюджет ${money(a.spend)}`}>
                          <span className="text-[10px]">{v == null ? '·' : pct(v)}</span>
                          <span className="text-[8px] opacity-80">{int(a.spend)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MpAdsReport
