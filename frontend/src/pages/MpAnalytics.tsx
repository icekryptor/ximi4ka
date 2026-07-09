import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { mpAnalyticsApi, MpPlatform, MpSummaryRow, MpDailyRow, MpRange } from '../api/mpAnalytics'
import { ManualImport } from '../components/mp/ManualImport'
import { useToast } from '../contexts/ToastContext'

const money = (v: number | null): string =>
  v == null ? '—' : `${Math.round(v).toLocaleString('ru-RU')} ₽`
const int = (v: number | null): string => (v == null ? '—' : Math.round(v).toLocaleString('ru-RU'))
const pct = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`)
const ratio = (a: number | null, b: number | null): string =>
  !a || !b ? '—' : `${((a / b) * 100).toFixed(1)}%`
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 400, label: 'Весь период' },
]

const monthRange = (ym: string): { from: string; to: string } => {
  const [y, m] = ym.split('-').map(Number)
  const from = `${ym}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from, to: `${ym}-${String(last).padStart(2, '0')}` }
}

const MpAnalytics = () => {
  const toast = useToast()
  const [platform, setPlatform] = useState<MpPlatform>('wb')
  // период: пресет по дням ИЛИ явный from/to (месяц/произвольный)
  const [days, setDays] = useState(30)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [month, setMonth] = useState('')
  const useRange = !!(from && to)
  const periodLabel = useRange ? `${from} — ${to}` : `${days} дней`

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [summary, setSummary] = useState<MpSummaryRow[]>([])
  const [daily, setDaily] = useState<MpDailyRow[]>([])

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
      const [s, d] = await Promise.all([
        mpAnalyticsApi.summary(platform, req),
        mpAnalyticsApi.daily(platform, req),
      ])
      setSummary(s)
      setDaily(d)
    } catch (err) {
      console.error('mp-analytics load failed', err)
      toast.error('Не удалось загрузить аналитику')
    } finally {
      setLoading(false)
    }
  }, [platform, days, from, to, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await mpAnalyticsApi.sync(Math.max(days, 30))
      toast.success('Синхронизация запущена — данные обновятся через ~минуту')
      setTimeout(() => {
        load()
        setSyncing(false)
      }, 75_000)
    } catch (err: any) {
      toast.error('Ошибка синка: ' + (err.response?.data?.error || err.message))
      setSyncing(false)
    }
  }

  // продукты по убыванию выручки
  const products = useMemo(
    () => summary.filter((s) => (s.orders_sum ?? 0) > 0 || (s.orders_count ?? 0) > 0),
    [summary],
  )
  const totalOrders = useMemo(() => products.reduce((a, s) => a + (s.orders_sum ?? 0), 0), [products])
  const totalBuyouts = useMemo(() => products.reduce((a, s) => a + (s.buyouts_sum ?? 0), 0), [products])

  // пивот дневной выручки: дата → sku → orders_sum
  const { dates, pivot } = useMemo(() => {
    const p = new Map<string, Map<string, number>>()
    const ds = new Set<string>()
    for (const r of daily) {
      ds.add(r.date)
      if (!p.has(r.date)) p.set(r.date, new Map())
      p.get(r.date)!.set(r.sku, r.orders_sum ?? 0)
    }
    return { dates: [...ds].sort((a, b) => b.localeCompare(a)), pivot: p }
  }, [daily])

  // воронка: агрегаты по sku за период
  const funnel = useMemo(() => {
    const m = new Map<string, { views: number; cart: number; orders: number; buyouts: number }>()
    for (const r of daily) {
      const cur = m.get(r.sku) ?? { views: 0, cart: 0, orders: 0, buyouts: 0 }
      cur.views += r.views ?? 0
      cur.cart += r.cart ?? 0
      cur.orders += r.orders_count ?? 0
      cur.buyouts += r.buyouts_count ?? 0
      m.set(r.sku, cur)
    }
    return m
  }, [daily])

  const nameBySku = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of summary) m.set(s.sku, s.product_name)
    for (const r of daily) if (!m.has(r.sku)) m.set(r.sku, r.product_name)
    return m
  }, [summary, daily])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Аналитика продаж</h1>
        </div>
        <button onClick={handleSync} disabled={syncing || platform !== 'wb'} className="btn btn-primary flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизирую...' : 'Собрать сейчас'}
        </button>
      </div>

      <ManualImport platform={platform} kind="funnel" onImported={load} />

      {/* Площадка + период */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlatform('wb')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${platform === 'wb' ? 'bg-primary-500 text-white' : 'bg-card border border-brand-border text-brand-text-secondary'}`}
        >
          WB
        </button>
        <button
          onClick={() => setPlatform('ozon')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${platform === 'ozon' ? 'bg-primary-500 text-white' : 'bg-card border border-brand-border text-brand-text-secondary'}`}
        >
          Ozon
        </button>
        <span className="mx-2 h-5 w-px bg-brand-border" />
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPreset(p.days)}
            className={`px-3 py-2 rounded-xl text-sm font-medium ${!useRange && days === p.days ? 'bg-primary-500 text-white' : 'bg-card border border-brand-border text-brand-text-secondary'}`}
          >
            {p.label}
          </button>
        ))}
        {/* Месяц */}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonthPeriod(e.target.value)}
          title="Выбрать месяц"
          className="px-3 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary"
        />
        {/* Произвольный период */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setMonth('')
            }}
            className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary"
          />
          <span className="text-brand-text-secondary/60">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setMonth('')
            }}
            className="px-2 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : products.length === 0 ? (
        <div className="card !p-10 text-center text-brand-text-secondary">
          Данных пока нет — нажми «Собрать сейчас» или дождись суточного синка.
        </div>
      ) : (
        <>
          {/* Итоги по продуктам */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-brand-text">Итоги по продуктам ({periodLabel})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                    <th className="py-2 pr-4 font-semibold">Продукт</th>
                    <th className="py-2 pr-4 font-semibold text-right">Сумма заказов</th>
                    <th className="py-2 pr-4 font-semibold text-right">Доля</th>
                    <th className="py-2 pr-4 font-semibold text-right">Заказов, шт</th>
                    <th className="py-2 pr-4 font-semibold text-right">Выкупы</th>
                    <th className="py-2 font-semibold text-right">Δ к пред.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((s) => (
                    <tr key={s.sku} className="border-b border-brand-border/50">
                      <td className="py-1.5 pr-4">
                        <span className="text-brand-text">{s.product_name}</span>
                        <span className="ml-1 font-mono text-[10px] text-brand-text-secondary/60">{s.sku}</span>
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums font-semibold text-brand-text">{money(s.orders_sum)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{pct(s.share_pct)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{int(s.orders_count)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{money(s.buyouts_sum)}</td>
                      <td className={`py-1.5 text-right tabular-nums ${(s.orders_sum_delta ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {s.orders_sum_delta == null ? '—' : `${s.orders_sum_delta >= 0 ? '+' : ''}${money(s.orders_sum_delta)}`}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-brand-text">
                    <td className="py-2 pr-4">Всего</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(totalOrders)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">100%</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(products.reduce((a, s) => a + (s.orders_count ?? 0), 0))}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(totalBuyouts)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Воронка по продуктам */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-brand-text">Воронка ({periodLabel})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                    <th className="py-2 pr-4 font-semibold">Продукт</th>
                    <th className="py-2 pr-4 font-semibold text-right">Показы</th>
                    <th className="py-2 pr-4 font-semibold text-right">В корзину</th>
                    <th className="py-2 pr-4 font-semibold text-right">Заказы, шт</th>
                    <th className="py-2 pr-4 font-semibold text-right">Выкупы, шт</th>
                    <th className="py-2 pr-4 font-semibold text-right">Конв. в корзину</th>
                    <th className="py-2 pr-4 font-semibold text-right">Конв. в заказ</th>
                    <th className="py-2 font-semibold text-right">% выкупа</th>
                  </tr>
                </thead>
                <tbody>
                  {[...funnel.entries()]
                    .sort((a, b) => b[1].orders - a[1].orders)
                    .map(([sku, f]) => (
                      <tr key={sku} className="border-b border-brand-border/50">
                        <td className="py-1.5 pr-4 text-brand-text">{nameBySku.get(sku) ?? sku}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{int(f.views)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{int(f.cart)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{int(f.orders)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{int(f.buyouts)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text">{ratio(f.cart, f.views)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text">{ratio(f.orders, f.cart)}</td>
                        <td className="py-1.5 text-right tabular-nums text-brand-text">{ratio(f.buyouts, f.orders)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Дневная выручка по продуктам */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-brand-text">Выручка заказов по дням, ₽</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                    <th className="py-2 pr-4 font-semibold whitespace-nowrap">Дата</th>
                    {products.map((s) => (
                      <th key={s.sku} className="py-2 pr-4 font-semibold text-right whitespace-nowrap">
                        <span className="block max-w-[120px] truncate">{s.product_name}</span>
                      </th>
                    ))}
                    <th className="py-2 font-semibold text-right">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((d) => {
                    const row = pivot.get(d)
                    const tot = products.reduce((a, s) => a + (row?.get(s.sku) ?? 0), 0)
                    return (
                      <tr key={d} className="border-b border-brand-border/50">
                        <td className="py-1.5 pr-4 tabular-nums text-brand-text-secondary whitespace-nowrap">{dayLabel(d)}</td>
                        {products.map((s) => (
                          <td key={s.sku} className="py-1.5 pr-4 text-right tabular-nums text-brand-text">
                            {money(row?.get(s.sku) ?? 0)}
                          </td>
                        ))}
                        <td className="py-1.5 text-right tabular-nums font-semibold text-brand-text">{money(tot)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MpAnalytics
