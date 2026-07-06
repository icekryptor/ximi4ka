import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, ChevronDown, ChevronUp, Clock, Percent, RefreshCw } from 'lucide-react'
import {
  discountTrackerApi,
  DiscountAlertRow,
  DiscountPlatform,
  PriceHistoryRow,
  PriceHourlyRow,
  PriceLatestRow,
} from '../api/discountTracker'
import { HourlyAvgTable } from '../components/discount/HourlyAvgTable'
import { NeatHeatGrid, HeatPoint, dayKeyOf } from '../components/discount/NeatHeatGrid'
import { useToast } from '../contexts/ToastContext'

type PlatformFilter = 'all' | DiscountPlatform

const PLATFORM_FILTERS: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'wb', label: 'WB' },
  { value: 'ozon', label: 'Ozon' },
]

const PLATFORM_LABELS: Record<DiscountPlatform, string> = {
  wb: 'WB',
  ozon: 'Ozon',
}

const PLATFORM_BADGES: Record<DiscountPlatform, string> = {
  wb: 'bg-purple-100 text-purple-700',
  ozon: 'bg-blue-100 text-blue-700',
}

/** Цвет доли площадки: ≥10% зелёный, 5–10% жёлтый, <5% красный */
const pctColor = (pct: number | null): string => {
  if (pct == null) return 'text-brand-text-secondary'
  const v = pct * 100
  if (v >= 10) return 'text-green-600'
  if (v >= 5) return 'text-amber-500'
  return 'text-red-600'
}

const formatPct = (pct: number | null): string =>
  pct == null ? '—' : `${(pct * 100).toFixed(1)}%`

const formatDeltaPp = (delta: number): string => {
  const pp = delta * 100
  const sign = pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(1)} п.п.`
}

const priceFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

const formatPrice = (v: number | null): string =>
  v == null ? '—' : `${priceFormatter.format(v)} ₽`

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const rowKey = (platform: string, sku: string): string => `${platform}:${sku}`

const PlatformBadge = ({ platform }: { platform: DiscountPlatform }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PLATFORM_BADGES[platform]}`}
  >
    {PLATFORM_LABELS[platform]}
  </span>
)

/**
 * Heatmap доли площадки: столбцы — дни, строки — часы. Аккуратные плитки
 * (общий NeatHeatGrid). Ячейка = последний снапшот platform_pct за час.
 */
const SppHeatmap = ({ history }: { history: PriceHistoryRow[] }) => {
  const points = useMemo<HeatPoint[]>(() => {
    const g = new Map<string, HeatPoint>()
    for (const p of history) {
      if (p.platform_pct == null) continue
      const dt = new Date(p.captured_at)
      const day = dayKeyOf(dt)
      // несколько снапшотов в час → берём последний (history отсортирован ASC)
      g.set(`${day}|${dt.getHours()}`, { day, hour: dt.getHours(), pct: (p.platform_pct as number) * 100 })
    }
    return [...g.values()]
  }, [history])

  return <NeatHeatGrid points={points} emptyHint="Нет данных за период" />
}

const DiscountTracker = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<PriceLatestRow[]>([])
  const [alerts, setAlerts] = useState<DiscountAlertRow[]>([])
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [historyMap, setHistoryMap] = useState<Record<string, PriceHistoryRow[]>>({})
  const [historyLoadingKey, setHistoryLoadingKey] = useState<string | null>(null)
  const [hourly, setHourly] = useState<PriceHourlyRow[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [latestResult, alertsResult, hourlyResult] = await Promise.allSettled([
        discountTrackerApi.latest(),
        discountTrackerApi.alerts(),
        discountTrackerApi.hourly(24),
      ])
      if (latestResult.status === 'fulfilled') setRows(latestResult.value)
      else {
        console.error('Failed to load latest snapshots:', latestResult.reason)
        toast.error('Не удалось загрузить снапшоты цен')
      }
      if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value)
      else console.error('Failed to load alerts:', alertsResult.reason)
      if (hourlyResult.status === 'fulfilled') setHourly(hourlyResult.value)
      else console.error('Failed to load hourly averages:', hourlyResult.reason)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await discountTrackerApi.run()
      toast.success(`Готово: снапшотов ${result.snapshots}, алертов ${result.alerts}`)
      setHistoryMap({})
      await loadData()
    } catch (err: any) {
      toast.error('Ошибка запуска: ' + (err.response?.data?.error || err.message))
    } finally {
      setRunning(false)
    }
  }

  const toggleRow = async (row: PriceLatestRow) => {
    const key = rowKey(row.platform, row.sku)
    if (expandedKey === key) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(key)
    if (!historyMap[key]) {
      setHistoryLoadingKey(key)
      try {
        const history = await discountTrackerApi.history(row.platform, row.sku, 24 * 30)
        setHistoryMap(prev => ({ ...prev, [key]: history }))
      } catch (err) {
        console.error('Failed to load history:', err)
        toast.error('Не удалось загрузить историю снапшотов')
      } finally {
        setHistoryLoadingKey(null)
      }
    }
  }

  const filteredRows = useMemo(
    () => (filter === 'all' ? rows : rows.filter(r => r.platform === filter)),
    [rows, filter],
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Percent className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Трекер скидок</h1>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="btn btn-primary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Собираю...' : 'Запустить сейчас'}
        </button>
      </div>

      <div className="text-sm text-brand-text-secondary">
        СПП на WB и соинвест на Ozon: доля площадки в витринной цене. Витрина снимается каждые 5 минут,
        цена продавца обновляется реже (кеш ~30 мин).
      </div>

      {/* Platform filter */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORM_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary-500 text-white'
                : 'bg-card border border-brand-border text-brand-text-secondary hover:bg-brand-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card !p-10 text-center text-brand-text-secondary">
          Снапшотов ещё нет — запусти вручную или дождись часового крона
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-subtle border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text whitespace-nowrap">
                    Платформа
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text">Товар</th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text whitespace-nowrap">
                    Цена продавца
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text whitespace-nowrap">
                    Витрина
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text whitespace-nowrap">
                    СПП / соинвест
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text whitespace-nowrap">
                    Обновлено
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-brand-text-secondary">
                      Нет данных по выбранной платформе
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => {
                    const key = rowKey(row.platform, row.sku)
                    const isExpanded = expandedKey === key
                    const history = historyMap[key]
                    return (
                      <Fragment key={key}>
                        <tr
                          onClick={() => toggleRow(row)}
                          className={`border-b border-brand-border cursor-pointer transition-colors hover:bg-primary-50/30 ${
                            isExpanded ? 'bg-primary-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <PlatformBadge platform={row.platform} />
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-brand-text-secondary shrink-0" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-brand-text-secondary shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-brand-text">
                                  {row.product_name || row.sku}
                                </div>
                                {row.product_name && row.product_name !== row.sku && (
                                  <div className="text-xs text-brand-text-secondary font-mono">
                                    {row.sku}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-brand-text">
                            {formatPrice(row.seller_price)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-brand-text">
                            {formatPrice(row.shelf_price)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right tabular-nums font-bold ${pctColor(row.platform_pct)}`}
                          >
                            {formatPct(row.platform_pct)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-brand-text-secondary whitespace-nowrap">
                            {formatDateTime(row.captured_at)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-brand-border bg-subtle/50">
                            <td colSpan={6} className="py-4 px-6">
                              {historyLoadingKey === key ? (
                                <div className="flex items-center gap-2 text-sm text-brand-text-secondary py-4">
                                  <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                                  Загружаю историю...
                                </div>
                              ) : history ? (
                                <div className="space-y-4">
                                  <div className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide">
                                    Доля площадки по часам (день × час)
                                  </div>
                                  <SppHeatmap history={history} />
                                </div>
                              ) : (
                                <div className="text-sm text-brand-text-secondary py-2">
                                  История недоступна
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Почасовое среднее */}
      {!loading && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-brand-text">Почасовое среднее СПП (24 ч)</h2>
          </div>
          <HourlyAvgTable rows={hourly} platform={filter} />
        </div>
      )}

      {/* Alerts */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-brand-text">Последние алерты</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="text-sm text-brand-text-secondary">Алертов пока не было</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-brand-text-secondary border-b border-brand-border">
                  <th className="text-left py-2 pr-4 font-medium">Платформа</th>
                  <th className="text-left py-2 pr-4 font-medium">SKU</th>
                  <th className="text-right py-2 pr-4 font-medium">Текущая доля</th>
                  <th className="text-right py-2 font-medium">Когда</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr
                    key={rowKey(a.platform, a.sku)}
                    className="border-b border-brand-border/60 last:border-0"
                  >
                    <td className="py-2 pr-4">
                      <PlatformBadge platform={a.platform} />
                    </td>
                    <td className="py-2 pr-4 font-mono text-brand-text">{a.sku}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums font-semibold ${pctColor(a.last_pct)}`}>
                      {formatPct(a.last_pct)}
                    </td>
                    <td className="py-2 text-right text-brand-text-secondary whitespace-nowrap">
                      {formatDateTime(a.last_alerted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscountTracker
