import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../App'
import { RefreshCw, Key, ChevronDown, ChevronUp } from 'lucide-react'
import { wbFinanceApi } from '../api/wbFinance'
import { WbFinanceAnalytics, WbFinanceArticle, WbFinanceSyncStatus, WbTokenStatus } from '../api/types'

// ─── Metric rows definition ───

interface MetricRow {
  key: string
  label: string
  format: 'int' | 'currency' | 'percent'
  agg: 'sum' | 'avg'
  separator?: boolean  // visual separator line above this row
}

const METRIC_ROWS: MetricRow[] = [
  { key: 'buyouts_sum',      label: 'Выкупы (₽)',         format: 'currency', agg: 'sum' },
  { key: 'sales_count',      label: 'Продажи (шт)',       format: 'int',      agg: 'sum' },
  { key: 'returns_sum',      label: 'Возвраты (₽)',       format: 'currency', agg: 'sum' },
  { key: 'returns_count',    label: 'Возвраты (шт)',      format: 'int',      agg: 'sum' },
  { key: 'transfer_amount',  label: 'К перечислению',     format: 'currency', agg: 'sum', separator: true },
  { key: 'pct_transfer',     label: '% к перечислению',   format: 'percent',  agg: 'avg' },
  { key: 'commission',       label: 'Комиссия ВБ',       format: 'currency', agg: 'sum', separator: true },
  { key: 'pct_commission',   label: '% комиссии',         format: 'percent',  agg: 'avg' },
  { key: 'logistics_cost',   label: 'Логистика',          format: 'currency', agg: 'sum', separator: true },
  { key: 'pct_logistics',    label: '% логистики',        format: 'percent',  agg: 'avg' },
  { key: 'storage_cost',     label: 'Хранение',           format: 'currency', agg: 'sum' },
  { key: 'pct_storage',      label: '% хранения',         format: 'percent',  agg: 'avg' },
  { key: 'acceptance_cost',  label: 'Приёмка',            format: 'currency', agg: 'sum' },
  { key: 'pct_acceptance',   label: '% приёмки',          format: 'percent',  agg: 'avg' },
  { key: 'other_costs',      label: 'Прочие расходы',     format: 'currency', agg: 'sum' },
  { key: 'pct_other',        label: '% прочих',           format: 'percent',  agg: 'avg' },
]

// ─── Formatters ───

function formatValue(value: number, format: 'int' | 'currency' | 'percent'): string {
  if (format === 'int') return Math.round(value).toLocaleString('ru-RU')
  if (format === 'percent') return value.toFixed(2) + '%'
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽'
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

/** Compute summary: sum for absolute metrics, average of non-zero for rates */
function computeSummary(values: number[], agg: 'sum' | 'avg'): number {
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  if (agg === 'sum') return sum
  const nonZero = values.filter(v => v !== 0)
  return nonZero.length > 0 ? sum / nonZero.length : 0
}

// ─── Helper: date range defaults ───

function getDefaultDates() {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

// ─── Component ───

const WbFinanceReports = () => {
  const { showToast } = useToast()
  const defaults = getDefaultDates()

  // Token
  const [tokenStatus, setTokenStatus] = useState<WbTokenStatus | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)

  // Dates + groupBy
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [groupBy, setGroupBy] = useState<'day' | 'week'>('day')

  // Data
  const [analytics, setAnalytics] = useState<WbFinanceAnalytics | null>(null)
  const [articles, setArticles] = useState<WbFinanceArticle[]>([])
  const [syncStatus, setSyncStatus] = useState<WbFinanceSyncStatus | null>(null)
  const [selectedNmId, setSelectedNmId] = useState<number | undefined>(undefined)

  // Loading states
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)

  // ─── Token ───

  const loadTokenStatus = useCallback(async () => {
    try {
      const status = await wbFinanceApi.getTokenStatus()
      setTokenStatus(status)
    } catch { /* ignore */ }
  }, [])

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return
    try {
      const result = await wbFinanceApi.saveToken(tokenInput.trim())
      setTokenStatus({ hasToken: result.hasToken, maskedToken: result.maskedToken })
      setTokenInput('')
      setShowTokenInput(false)
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Ошибка сохранения токена', 'error')
    }
  }

  // ─── Sync ───

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await wbFinanceApi.syncStats(startDate, endDate)
      showToast(result.message)
      await loadSyncStatus()
      await loadAnalytics()
      await loadArticles()
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Ошибка синхронизации', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await wbFinanceApi.getSyncStatus()
      setSyncStatus(status)
    } catch { /* ignore */ }
  }, [])

  // ─── Analytics ───

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const data = await wbFinanceApi.getAnalytics({
        startDate,
        endDate,
        nmId: selectedNmId,
        groupBy,
      })
      setAnalytics(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedNmId, groupBy])

  const loadArticles = useCallback(async () => {
    try {
      const data = await wbFinanceApi.getArticles()
      setArticles(data)
    } catch { /* ignore */ }
  }, [])

  // ─── Effects ───

  useEffect(() => { loadTokenStatus() }, [loadTokenStatus])
  useEffect(() => { loadSyncStatus() }, [loadSyncStatus])
  useEffect(() => { loadArticles() }, [loadArticles])
  useEffect(() => { loadAnalytics() }, [loadAnalytics])

  // ─── Render helpers ───

  const hasData = analytics && analytics.dates.length > 0

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-brand-text">Финотчёты ВБ</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Token */}
          <button
            onClick={() => setShowTokenInput(!showTokenInput)}
            className={`btn btn-sm ${tokenStatus?.hasToken ? 'btn-outline' : 'btn-primary'} flex items-center gap-1`}
          >
            <Key className="h-4 w-4" />
            {tokenStatus?.hasToken ? 'Токен ✓' : 'Ввести токен'}
          </button>

          {/* Group by */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'day' | 'week')}
            className="input input-sm w-auto"
          >
            <option value="day">По дням</option>
            <option value="week">По неделям</option>
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-date"
            />
            <span className="text-brand-text-secondary text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-date"
            />
          </div>

          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing || !tokenStatus?.hasToken}
            className="btn btn-sm btn-primary flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синк'}
          </button>
        </div>
      </div>

      {/* Token input */}
      {showTokenInput && (
        <div className="card p-4 flex items-center gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Вставьте WB API токен (Статистика)"
            className="input flex-1"
          />
          <button onClick={handleSaveToken} className="btn btn-primary btn-sm">Сохранить</button>
          <button onClick={() => setShowTokenInput(false)} className="btn btn-outline btn-sm">Отмена</button>
          {tokenStatus?.maskedToken && (
            <span className="text-xs text-brand-text-secondary ml-2">Текущий: {tokenStatus.maskedToken}</span>
          )}
        </div>
      )}

      {/* Sync status */}
      {syncStatus && syncStatus.daysCount > 0 && (
        <p className="text-xs text-brand-text-secondary">
          Данные: {syncStatus.firstDate} — {syncStatus.lastDate} ({syncStatus.daysCount} дн.)
        </p>
      )}

      {/* Article tabs */}
      {articles.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setSelectedNmId(undefined)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedNmId === undefined
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-brand-text-secondary hover:bg-gray-200'
            }`}
          >
            Сводная
          </button>
          {articles.map((a) => (
            <button
              key={a.nm_id}
              onClick={() => setSelectedNmId(a.nm_id)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedNmId === a.nm_id
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-brand-text-secondary hover:bg-gray-200'
              }`}
            >
              {a.nm_id}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading && !hasData ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : !hasData ? (
        <div className="card p-8 text-center text-brand-text-secondary">
          {!tokenStatus?.hasToken
            ? 'Введите WB API токен для начала работы'
            : 'Нет данных. Нажмите «Синк» для загрузки.'}
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden relative">
          <div className="pivot-mask-left" style={{ left: 270 }} />
          <div className="overflow-x-auto pivot-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-border">
                {/* Sticky metric name */}
                <th className="text-left px-3 py-2 font-semibold text-brand-text-secondary sticky left-0 bg-gray-50 z-20 min-w-[160px] border-r border-brand-border">
                  Метрика
                </th>
                {/* Sticky summary */}
                <th className="text-left px-3 py-2 font-semibold text-primary-700 sticky left-[160px] bg-primary-50 z-20 min-w-[110px] ">
                  Итого
                </th>
                {/* Date columns */}
                {analytics!.dates.map((d) => (
                  <th key={d} className="text-left px-3 py-2 font-medium text-brand-text-secondary whitespace-nowrap min-w-[90px]">
                    {formatDateShort(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row, idx) => {
                const values = analytics!.metrics[row.key] || []
                const summary = computeSummary(values, row.agg)
                const isEven = idx % 2 === 0
                const stickyBg = isEven ? 'bg-white' : 'bg-[#fafafb]'
                const summaryBg = isEven ? 'bg-[#f3f0ff]' : 'bg-[#edeafc]'

                return (
                  <tr
                    key={row.key}
                    className={`${isEven ? 'bg-white' : 'bg-[#fafafb]'} ${row.separator ? 'border-t-2 border-gray-200' : 'border-b border-gray-50'}`}
                  >
                    {/* Metric name — sticky */}
                    <td className={`px-3 py-1.5 font-medium text-brand-text sticky left-0 z-10 ${stickyBg} border-r border-brand-border`}>
                      {row.label}
                    </td>
                    {/* Summary — sticky */}
                    <td className={`px-3 py-1.5 font-semibold text-primary-800 sticky left-[160px] z-10 ${summaryBg} `}>
                      {formatValue(summary, row.format)}
                    </td>
                    {/* Data cells */}
                    {values.map((v, i) => (
                      <td key={i} className="px-3 py-1.5 text-left text-brand-text whitespace-nowrap">
                        {formatValue(v, row.format)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default WbFinanceReports
