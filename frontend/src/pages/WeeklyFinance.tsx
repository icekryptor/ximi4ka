import { useCallback, useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Wallet, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { apiClient } from '../api/client'

/** «Финансовые показатели недели»: сводка + круговые расходов и чистой прибыли. */

interface WeeklyData {
  week: { start: string; end: string }
  sources: { finance: boolean; funnel: boolean; ads: boolean }
  metrics: {
    orders_sum: number; buyouts_sum: number; transfer_amount: number
    logistics_cost: number; storage_cost: number; other_costs: number
    ad_spend: number; commission: number; commission_rate: number
    payout_total: number; transfer_estimated: boolean
  }
  profit: {
    cogs: number; tax_rate: number; tax: number; net_profit: number
    cogs_detail: Array<{ sku: string; kit: string | null; qty: number; unit_cost: number | null; total: number | null }>
  }
}

const money = (v: number): string => `${Math.round(v).toLocaleString('ru-RU')} ₽`
const pctOf = (v: number, base: number): string => (base > 0 ? `${((v / base) * 100).toFixed(1)}%` : '—')

const mondayOf = (d: Date): string => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}
const shiftWeek = (iso: string, weeks: number): string => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}
const rangeLabel = (start: string, end: string): string => {
  const f = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  return `${f(start)} – ${f(end)}`
}

// приглушённая палитра в тон хитмапам
const COLORS = {
  commission: '#b39ddb', // комиссия ВБ — сиреневый
  logistics: '#90caf9',  // логистика — голубой
  ads: '#ffcc80',        // реклама — оранжевый
  storage: '#bcaaa4',    // хранение — кофейный
  ours: '#a5d6a7',       // наши деньги — зелёный
  cogs: '#ef9a9a',       // себестоимость — красный
  tax: '#ffe082',        // налоги — жёлтый
  profit: '#a5d6a7',     // ЧП — зелёный
}

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-xl border border-brand-border bg-card px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-brand-text">{p.name}</div>
      <div className="tabular-nums text-brand-text-secondary">{money(p.value)}</div>
    </div>
  )
}

const DonutWithLegend = ({ title, subtitle, data, base }: {
  title: string
  subtitle: string
  data: Array<{ name: string; value: number; color: string }>
  base: number
}) => {
  const shown = data.filter((d) => d.value > 0)
  return (
    <div className="card space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-brand-text">{title}</h2>
        <p className="mt-0.5 text-xs text-brand-text-secondary">{subtitle}</p>
      </div>
      {shown.length === 0 || base <= 0 ? (
        <div className="py-10 text-center text-sm text-brand-text-secondary">Нет данных за неделю.</div>
      ) : (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <div className="h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}
                  paddingAngle={1.5} strokeWidth={1}>
                  {shown.map((d) => <Cell key={d.name} fill={d.color} stroke="rgba(0,0,0,0.06)" />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1.5">
            {shown.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-sm" title={money(d.value)}>
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-inset ring-black/10" style={{ backgroundColor: d.color }} />
                <span className="flex-1 truncate text-brand-text-secondary">{d.name}</span>
                <span className="font-semibold tabular-nums text-brand-text">{pctOf(d.value, base)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const WeeklyFinance = () => {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [data, setData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiClient.get<WeeklyData>('/wb-finance/weekly', { params: { start: weekStart } })
      setData(r.data)
    } catch {
      setData(null)
    } finally { setLoading(false) }
  }, [weekStart])
  useEffect(() => { load() }, [load])

  const m = data?.metrics
  const p = data?.profit

  // Диаграмма 1: доли расходов — 100% = сумма выкупов
  const expensePie = useMemo(() => {
    if (!m) return []
    const ours = Math.max(0, m.buyouts_sum - m.commission - m.logistics_cost - m.ad_spend - m.storage_cost)
    return [
      { name: 'Комиссия ВБ', value: Math.max(0, m.commission), color: COLORS.commission },
      { name: 'Логистика', value: Math.max(0, m.logistics_cost), color: COLORS.logistics },
      { name: 'Реклама', value: Math.max(0, m.ad_spend), color: COLORS.ads },
      { name: 'Хранение', value: Math.max(0, m.storage_cost), color: COLORS.storage },
      { name: 'Наши деньги', value: ours, color: COLORS.ours },
    ]
  }, [m])

  // Диаграмма 2: чистая прибыль — 100% = итого к оплате
  const profitPie = useMemo(() => {
    if (!m || !p) return []
    return [
      { name: 'Себестоимость (COGS)', value: Math.max(0, p.cogs), color: COLORS.cogs },
      { name: `Налоги (${Math.round(p.tax_rate * 100)}%)`, value: Math.max(0, p.tax), color: COLORS.tax },
      { name: 'Чистая прибыль', value: Math.max(0, p.net_profit), color: COLORS.profit },
    ]
  }, [m, p])

  const rows: Array<{ label: string; value: number; strong?: boolean; pct?: string }> = m ? [
    { label: 'Сумма заказов за неделю', value: m.orders_sum },
    { label: 'Сумма выкупов за неделю', value: m.buyouts_sum },
    { label: m.transfer_estimated ? 'К перечислению за товар (оценка)' : 'К перечислению за товар', value: m.transfer_amount, pct: pctOf(m.transfer_amount, m.buyouts_sum) },
    { label: `Комиссия ВБ (${(m.commission_rate * 100).toFixed(1).replace('.', ',')}%)`, value: m.commission, pct: pctOf(m.commission, m.buyouts_sum) },
    { label: 'Логистика', value: m.logistics_cost, pct: pctOf(m.logistics_cost, m.buyouts_sum) },
    { label: 'Хранение', value: m.storage_cost, pct: pctOf(m.storage_cost, m.buyouts_sum) },
    { label: 'Прочие удержания', value: m.other_costs, pct: pctOf(m.other_costs, m.buyouts_sum) },
    { label: 'Рекламный бюджет', value: m.ad_spend, pct: pctOf(m.ad_spend, m.buyouts_sum) },
    { label: m.transfer_estimated ? 'Итого к оплате (оценка)' : 'Итого к оплате', value: m.payout_total, strong: true, pct: pctOf(m.payout_total, m.buyouts_sum) },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Wallet className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Финансовые показатели недели</h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-brand-border bg-card p-0.5">
          <button onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
            className="rounded-lg p-1.5 text-brand-text-secondary hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2 text-sm font-medium tabular-nums text-brand-text">
            {data ? rangeLabel(data.week.start, data.week.end) : rangeLabel(weekStart, shiftWeek(weekStart, 1))}
          </span>
          <button onClick={() => setWeekStart((w) => shiftWeek(w, 1))} disabled={weekStart >= mondayOf(new Date())}
            className="rounded-lg p-1.5 text-brand-text-secondary hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {data && !data.sources.finance && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Финотчёта WB за эту неделю ещё нет (подтягивается автосинком) — выкупы из воронки, «к перечислению» и «итого к оплате» посчитаны оценкой через комиссию-константу; логистика и хранение появятся с финотчётом.</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
      ) : !data ? (
        <div className="card !p-10 text-center text-brand-text-secondary">Не удалось загрузить сводку.</div>
      ) : (
        <>
          {/* Сводка недели */}
          <div className="card">
            <table className="min-w-full max-w-xl text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={`border-b border-brand-border/40 ${r.strong ? 'bg-primary-50/50' : ''}`}>
                    <td className={`py-1.5 pr-4 ${r.strong ? 'font-semibold text-brand-text' : 'text-brand-text-secondary'}`}>{r.label}</td>
                    <td className={`py-1.5 pr-4 text-right tabular-nums ${r.strong ? 'font-bold text-brand-text' : 'text-brand-text'}`}>{money(r.value)}</td>
                    <td className="py-1.5 text-right tabular-nums text-xs text-brand-text-secondary/70 w-16">{r.pct ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Диаграммы */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DonutWithLegend
              title="Структура расходов"
              subtitle="100% — сумма выкупов; наведи на сектор — сумма в ₽"
              data={expensePie}
              base={m!.buyouts_sum}
            />
            <DonutWithLegend
              title="Чистая прибыль"
              subtitle={`100% — итого к оплате (${m ? money(m.payout_total) : ''}); COGS = себестоимость проданных наборов`}
              data={profitPie}
              base={m!.payout_total}
            />
          </div>

          {/* COGS детализация */}
          {p && p.cogs_detail.length > 0 && (
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-brand-text">COGS — себестоимость проданного</h2>
              <table className="min-w-full max-w-xl text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-xs text-brand-text-secondary">
                    <th className="py-1.5 pr-4 font-semibold">Артикул / набор</th>
                    <th className="py-1.5 pr-4 font-semibold text-right">Продано, шт</th>
                    <th className="py-1.5 pr-4 font-semibold text-right">Себестоимость</th>
                    <th className="py-1.5 font-semibold text-right">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {p.cogs_detail.map((d) => (
                    <tr key={d.sku} className="border-b border-brand-border/40">
                      <td className="py-1.5 pr-4 font-mono text-brand-text">{d.kit || d.sku}{d.unit_cost == null && <span className="ml-1.5 text-xs text-amber-600">нет маппинга на набор</span>}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{d.qty}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{d.unit_cost == null ? '—' : money(d.unit_cost)}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{d.total == null ? '—' : money(d.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 pr-4 font-semibold text-brand-text">Итого COGS</td>
                    <td /><td />
                    <td className="py-1.5 text-right tabular-nums font-bold text-brand-text">{money(p.cogs)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default WeeklyFinance
