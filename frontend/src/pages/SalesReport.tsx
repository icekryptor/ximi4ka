import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, BarChart3 } from 'lucide-react'
import { kitsApi, Kit } from '../api/kits'
import {
  salesReportApi,
  SalesReportData,
  SalesReportSummary,
  CHANNEL_OPTIONS,
  METRIC_ROWS,
} from '../api/salesReport'
import ManualSalesEntryModal from '../components/ManualSalesEntryModal'

// ─── Formatters ───

function formatValue(value: number, format: 'int' | 'currency' | 'percent'): string {
  if (format === 'int') return Math.round(value).toLocaleString('ru-RU')
  if (format === 'percent') return value.toFixed(1) + '%'
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽'
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

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

const SalesReport = () => {
  const defaults = getDefaultDates()

  // Dates
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>(undefined)
  const [selectedKitId, setSelectedKitId] = useState<string | undefined>(undefined)

  // Data
  const [report, setReport] = useState<SalesReportData | null>(null)
  const [summary, setSummary] = useState<SalesReportSummary | null>(null)
  const [kits, setKits] = useState<Kit[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showEntryModal, setShowEntryModal] = useState(false)

  // ─── Load data ───

  const loadKits = useCallback(async () => {
    try {
      const data = await kitsApi.getAll()
      setKits(data)
    } catch { /* ignore */ }
  }, [])

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const data = await salesReportApi.getReport({
        startDate,
        endDate,
        channel: selectedChannel,
        kitId: selectedKitId,
      })
      setReport(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedChannel, selectedKitId])

  const loadSummary = useCallback(async () => {
    try {
      const data = await salesReportApi.getSummary({ startDate, endDate })
      setSummary(data)
    } catch { /* ignore */ }
  }, [startDate, endDate])

  // ─── WB Sync ───

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await salesReportApi.syncFromWb(startDate, endDate)
      const msg = result.message
        + (result.unmapped.length > 0 ? `\nНе привязаны nm_id: ${result.unmapped.join(', ')}` : '')
      alert(msg)
      await loadReport()
      await loadSummary()
    } catch (e: any) {
      alert(e.response?.data?.error || 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  // ─── Effects ───

  useEffect(() => { loadKits() }, [loadKits])
  useEffect(() => { loadReport() }, [loadReport])
  useEffect(() => { loadSummary() }, [loadSummary])

  // ─── Render ───

  const hasData = report && report.dates.length > 0
  const availableChannels = report?.channels || []

  // Summary cards data
  const totals = report?.totals
  const summaryCards = totals ? [
    { label: 'Выручка', value: formatValue(totals.total_revenue, 'currency'), color: 'text-brand-text' },
    { label: 'Прибыль', value: formatValue(totals.profit, 'currency'), color: totals.profit >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: 'Маржа', value: formatValue(totals.margin, 'percent'), color: totals.margin >= 0 ? 'text-green-600' : 'text-red-600' },
    { label: 'Продажи', value: `${totals.sales_count} шт`, color: 'text-brand-text' },
    { label: 'Логистика', value: formatValue(totals.logistics_cost, 'currency'), color: 'text-orange-600' },
    { label: 'Реклама', value: formatValue(totals.ad_spend, 'currency'), color: 'text-orange-600' },
  ] : null

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Отчёт о продажах</h1>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary px-3 py-1.5 text-sm rounded-xl flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синк...' : 'Синк ВБ'}
          </button>

          <button
            onClick={() => setShowEntryModal(true)}
            className="text-sm text-brand-text-secondary hover:text-brand-text flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Channel + Kit filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Channel tabs */}
        <button
          onClick={() => setSelectedChannel(undefined)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            !selectedChannel
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-brand-text-secondary hover:bg-gray-200'
          }`}
        >
          Все каналы
        </button>
        {(availableChannels.length > 0 ? availableChannels : CHANNEL_OPTIONS).map(ch => (
          <button
            key={ch}
            onClick={() => setSelectedChannel(selectedChannel === ch ? undefined : ch)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              selectedChannel === ch
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-brand-text-secondary hover:bg-gray-200'
            }`}
          >
            {ch}
          </button>
        ))}

        {/* Kit filter */}
        <select
          value={selectedKitId || ''}
          onChange={(e) => setSelectedKitId(e.target.value || undefined)}
          className="input input-sm w-auto ml-2"
        >
          <option value="">Все артикулы</option>
          {kits.map(k => (
            <option key={k.id} value={k.id}>
              {k.seller_sku ? `${k.seller_sku} — ` : ''}{k.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {summaryCards && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {summaryCards.map(card => (
            <div key={card.label} className="card p-4">
              <p className="text-xs text-brand-text-secondary mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Channel breakdown from summary */}
      {summary && summary.channels.length > 1 && !selectedChannel && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-brand-text-secondary mb-3">По каналам</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.channels.map(ch => (
              <div
                key={ch.channel_name}
                className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setSelectedChannel(ch.channel_name)}
              >
                <p className="text-sm font-medium text-brand-text">{ch.channel_name}</p>
                <p className="text-lg font-bold text-brand-text">{formatValue(ch.total_revenue, 'currency')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-medium ${ch.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatValue(ch.total_profit, 'currency')}
                  </span>
                  <span className="text-xs text-brand-text-secondary">
                    ({ch.avg_margin.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-xs text-brand-text-secondary mt-1">{ch.total_sales} продаж</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pivot Table */}
      {loading && !hasData ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : !hasData ? (
        <div className="card p-8 text-center text-brand-text-secondary">
          Нет данных за выбранный период. Нажмите «Синк ВБ» для загрузки данных Wildberries или «Добавить» для ручного ввода.
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden relative">
          <div className="pivot-mask-left" style={{ left: 250 }} />
          <div className="overflow-x-auto pivot-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left px-3 py-2 font-semibold text-brand-text-secondary sticky left-0 bg-gray-50 z-20 min-w-[140px] border-r border-brand-border">
                  Метрика
                </th>
                <th className="text-left px-3 py-2 font-semibold text-primary-700 sticky left-[140px] bg-primary-50 z-20 min-w-[110px] ">
                  Итого
                </th>
                {report!.dates.map(d => (
                  <th key={d} className="text-left px-3 py-2 font-medium text-brand-text-secondary whitespace-nowrap min-w-[90px]">
                    {formatDateShort(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((row, idx) => {
                const values = report!.metrics[row.key] || []
                const total = report!.totals[row.key] ?? 0
                const isEven = idx % 2 === 0
                const stickyBg = isEven ? 'bg-white' : 'bg-[#fafafb]'
                const summaryBg = isEven ? 'bg-[#f3f0ff]' : 'bg-[#edeafc]'

                return (
                  <tr
                    key={row.key}
                    className={`${isEven ? 'bg-white' : 'bg-[#fafafb]'} ${row.highlight ? 'border-t-2 border-gray-200' : 'border-b border-gray-50'}`}
                  >
                    <td className={`px-3 py-1.5 font-medium sticky left-0 z-10 ${stickyBg} border-r border-brand-border ${row.highlight ? 'text-brand-text font-semibold' : 'text-brand-text'}`}>
                      {row.label}
                    </td>
                    <td className={`px-3 py-1.5 font-semibold sticky left-[140px] z-10 ${summaryBg}  ${
                      row.highlight
                        ? total >= 0 ? 'text-green-700' : 'text-red-700'
                        : 'text-primary-800'
                    }`}>
                      {formatValue(total, row.format)}
                    </td>
                    {values.map((v, i) => (
                      <td
                        key={i}
                        className={`px-3 py-1.5 text-left whitespace-nowrap ${
                          row.highlight
                            ? v >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                            : 'text-brand-text'
                        }`}
                      >
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

      {/* Manual entry modal */}
      {showEntryModal && (
        <ManualSalesEntryModal
          kits={kits}
          onClose={() => setShowEntryModal(false)}
          onSaved={() => {
            setShowEntryModal(false)
            loadReport()
            loadSummary()
          }}
        />
      )}
    </div>
  )
}

export default SalesReport
