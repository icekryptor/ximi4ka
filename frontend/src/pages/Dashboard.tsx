import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { LayoutDashboard, ArrowUpRight, ArrowDownRight, X, BookOpen, Info, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { wbDashboardApi, WbDashboardData, DashMetric } from '../api/wbDashboard'

/**
 * Главная: график выручки по дням + компактные чипы-метрики с дельтой к прошлому
 * периоду (клик — детализация: формула, источники, мини-график) + регламенты БЗ.
 */

const fmtRub = (v: number): string => `${Math.round(v).toLocaleString('ru-RU')} ₽`
const fmtVal = (v: number | null, unit: DashMetric['unit']): string => {
  if (v == null) return '—'
  if (unit === 'rub') return fmtRub(v)
  if (unit === 'pct') return `${v.toFixed(2).replace(/\.?0+$/, '')}%`
  if (unit === 'pcs') return `${Math.round(v).toLocaleString('ru-RU')} шт`
  return String(v)
}
const dayLabel = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
]

/** Дельта хорошая/плохая → зелёный/красный (как в референсе TrueStats). */
const deltaTone = (m: DashMetric): 'good' | 'bad' | 'flat' => {
  if (m.deltaPct == null || m.deltaPct === 0) return 'flat'
  const up = m.deltaPct > 0
  return (up && m.goodWhen === 'up') || (!up && m.goodWhen === 'down') ? 'good' : 'bad'
}

const MetricChip = ({ m, onClick }: { m: DashMetric; onClick: () => void }) => {
  const tone = deltaTone(m)
  const toneCls = tone === 'good'
    ? 'border-green-200 bg-green-50/70 hover:border-green-300'
    : tone === 'bad'
      ? 'border-red-200 bg-red-50/70 hover:border-red-300'
      : 'border-brand-border bg-card hover:border-primary-300'
  return (
    <button onClick={onClick}
      className={`group rounded-xl border px-3 py-2 text-left shadow-soft transition-all hover:shadow-card ${toneCls}`}>
      <div className="flex items-center gap-1 text-[11px] text-brand-text-secondary">
        <span className="truncate">{m.label}</span>
        <Info className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-base font-bold leading-tight text-brand-text">{fmtVal(m.value, m.unit)}</span>
        {m.sub && <span className="text-xs text-brand-text-secondary">/ {fmtVal(m.sub.value, m.sub.unit)}</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] tabular-nums">
        <span className="text-brand-text-secondary/70">{m.prev == null ? '' : fmtVal(m.prev, m.unit)}</span>
        {m.deltaPct != null && (
          <span className={`flex items-center gap-0.5 rounded px-1 font-semibold ${
            tone === 'good' ? 'bg-green-100 text-green-700' : tone === 'bad' ? 'bg-red-100 text-red-700' : 'bg-muted text-brand-text-secondary'
          }`}>
            {m.deltaPct > 0 ? <ArrowUpRight className="h-3 w-3" /> : m.deltaPct < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
            {Math.abs(m.deltaPct).toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  )
}

const MetricModal = ({ m, onClose }: { m: DashMetric; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-card p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-brand-text">{m.label}</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-brand-text">{fmtVal(m.value, m.unit)}</span>
            {m.sub && <span className="text-sm text-brand-text-secondary">/ {fmtVal(m.sub.value, m.sub.unit)}</span>}
          </div>
          <div className="mt-0.5 text-sm text-brand-text-secondary">
            Прошлый период: {fmtVal(m.prev, m.unit)}
            {m.deltaPct != null && <> · Δ {m.deltaPct > 0 ? '+' : ''}{m.deltaPct.toFixed(1)}%</>}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-brand-text-secondary hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      {m.series && m.series.length > 1 && (
        <div className="mt-3 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.series}>
              <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip labelFormatter={(v) => dayLabel(String(v))}
                formatter={(v: unknown) => [fmtVal(Number(v), m.unit), m.label]} />
              <Bar dataKey="value" fill="#836efe" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-text-secondary">Как считается</div>
          <div className="mt-1 rounded-lg bg-muted/50 px-3 py-2 text-brand-text">{m.formula}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-text-secondary">Источники</div>
          <ul className="mt-1 space-y-1">
            {m.sources.map((s) => (
              <li key={s} className="flex items-start gap-1.5 text-brand-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />{s}
              </li>
            ))}
          </ul>
        </div>
        {m.note && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{m.note}</div>}
      </div>
    </div>
  </div>
)

const Dashboard = () => {
  const [days, setDays] = useState(7)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<WbDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const useRange = !!(from && to)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await wbDashboardApi.overview(from && to ? { from, to } : { days }))
    } catch (e) {
      console.error('dashboard load failed', e)
      setData(null)
    } finally { setLoading(false) }
  }, [days, from, to])
  useEffect(() => { load() }, [load])

  const setPreset = (d: number) => { setDays(d); setFrom(''); setTo('') }

  const openMetric = useMemo(
    () => (openKey && data ? data.metrics.find((m) => m.key === openKey) ?? null : null),
    [openKey, data],
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <LayoutDashboard className="h-6 w-6 text-primary-500" />
          <div>
            <h1 className="text-2xl font-bold text-brand-text">Оцифровка WB</h1>
            <p className="text-sm text-brand-text-secondary">
              {data ? `${dayLabel(data.range.from)} – ${dayLabel(data.range.to)} · сравнение с ${dayLabel(data.prevRange.from)} – ${dayLabel(data.prevRange.to)}` : 'Показатели за период и динамика'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-brand-border bg-card p-0.5">
            {PERIODS.map((p) => (
              <button key={p.days} onClick={() => setPreset(p.days)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!useRange && days === p.days ? 'bg-primary-500 text-white' : 'text-brand-text-secondary hover:text-brand-text'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-1 rounded-xl border p-1 ${useRange ? 'border-primary-400 bg-primary-50/50' : 'border-brand-border bg-card'}`}>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg bg-transparent px-2 py-1 text-sm text-brand-text-secondary focus:text-brand-text focus:outline-none" />
            <span className="text-brand-text-secondary">–</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg bg-transparent px-2 py-1 text-sm text-brand-text-secondary focus:text-brand-text focus:outline-none" />
            {useRange && (
              <button onClick={() => { setFrom(''); setTo('') }} title="Сбросить диапазон"
                className="rounded-md px-1.5 text-brand-text-secondary hover:text-brand-text">×</button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      ) : !data ? (
        <div className="card !p-10 text-center text-brand-text-secondary">Не удалось загрузить дашборд.</div>
      ) : (
        <>
          {data.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {data.warnings.map((w) => (
                <p key={w} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}

          {/* График выручки */}
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-brand-text">Выручка по дням</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chart}>
                  <defs>
                    <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#836efe" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#836efe" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gBuyouts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34a853" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34a853" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}к`} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip labelFormatter={(v) => dayLabel(String(v))}
                    formatter={(v: unknown, name: unknown) => [fmtRub(Number(v)), name === 'orders_sum' ? 'Заказы' : 'Выкупы']} />
                  <Legend formatter={(v) => (v === 'orders_sum' ? 'Заказы' : 'Выкупы')} />
                  <Area type="monotone" dataKey="orders_sum" stroke="#836efe" strokeWidth={2} fill="url(#gOrders)" />
                  <Area type="monotone" dataKey="buyouts_sum" stroke="#34a853" strokeWidth={2} fill="url(#gBuyouts)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Чипы метрик */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.metrics.map((m) => (
              <MetricChip key={m.key} m={m} onClick={() => setOpenKey(m.key)} />
            ))}
          </div>

          {/* Регламенты */}
          {data.kb.length > 0 && (
            <div className="card">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-500" />
                <h2 className="text-sm font-semibold text-brand-text">Регламенты · База знаний</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.kb.map((d) => (
                  <Link key={d.slug} to={`/production/knowledge-base?doc=${d.slug}`}
                    className="rounded-lg border border-brand-border bg-card px-2.5 py-1 text-xs text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700">
                    {d.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {openMetric && <MetricModal m={openMetric} onClose={() => setOpenKey(null)} />}
    </div>
  )
}

export default Dashboard
