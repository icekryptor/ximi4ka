import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../App'
import { wbAdsApi } from '../api/wbAds'
import { WbAdAnalytics, WbAdNote, WbAdArticle, WbAdSyncStatus, WbTokenStatus } from '../api/types'
import { formatCurrency } from '../utils/format'
import { RefreshCw, Megaphone, MessageSquare, X, Key, Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface MetricRow {
  key: string
  label: string
  format: 'int' | 'currency' | 'percent'
  /** 'sum' for absolute values, 'avg' for rates/percentages/cost-per metrics */
  agg: 'sum' | 'avg'
}

const METRIC_ROWS: MetricRow[] = [
  { key: 'views', label: 'Показы', format: 'int', agg: 'sum' },
  { key: 'clicks', label: 'Переходы', format: 'int', agg: 'sum' },
  { key: 'ctr', label: 'CTR', format: 'percent', agg: 'avg' },
  { key: 'atbs', label: 'Корзины', format: 'int', agg: 'sum' },
  { key: 'orders_count', label: 'Заказы (шт)', format: 'int', agg: 'sum' },
  { key: 'orders_sum', label: 'Заказы (₽)', format: 'currency', agg: 'sum' },
  { key: 'buyouts_count', label: 'Выкупы (шт)', format: 'int', agg: 'sum' },
  { key: 'buyouts_sum', label: 'Выкупы (₽)', format: 'currency', agg: 'sum' },
  { key: 'ad_spend', label: 'Расход', format: 'currency', agg: 'sum' },
  { key: 'cpc', label: 'CPC', format: 'currency', agg: 'avg' },
  { key: 'cpo', label: 'CPO', format: 'currency', agg: 'avg' },
  { key: 'cpm', label: 'CPM', format: 'currency', agg: 'avg' },
  { key: 'drr_orders', label: 'ДРРз (%)', format: 'percent', agg: 'avg' },
  { key: 'drr_buyouts', label: 'ДРРв (%)', format: 'percent', agg: 'avg' },
  { key: 'cr_to_cart', label: 'CR → корзину', format: 'percent', agg: 'avg' },
  { key: 'cr_to_order', label: 'CR → заказ', format: 'percent', agg: 'avg' },
]

/** Compute summary: sum for absolute metrics, average for rates */
function computeSummary(values: number[], agg: 'sum' | 'avg'): number {
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  if (agg === 'sum') return sum
  const nonZero = values.filter(v => v !== 0)
  return nonZero.length > 0 ? sum / nonZero.length : 0
}

function formatMetricValue(value: number, format: string): string {
  if (value === 0 && format !== 'int') return '—'
  switch (format) {
    case 'int':
      return new Intl.NumberFormat('ru-RU').format(Math.round(value))
    case 'currency':
      return formatCurrency(value)
    case 'percent':
      return value.toFixed(2) + '%'
    default:
      return String(value)
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

const today = new Date().toISOString().split('T')[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

const WbAdsAnalytics = () => {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)

  const [analytics, setAnalytics] = useState<WbAdAnalytics | null>(null)
  const [articles, setArticles] = useState<WbAdArticle[]>([])
  // undefined = сводная по всем артикулам
  const [selectedNmId, setSelectedNmId] = useState<number | undefined>()
  const [syncStatus, setSyncStatus] = useState<WbAdSyncStatus | null>(null)

  // Notes
  const [notes, setNotes] = useState<WbAdNote[]>([])
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  // Token
  const [tokenStatus, setTokenStatus] = useState<WbTokenStatus | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const loadTokenStatus = useCallback(async () => {
    try {
      const status = await wbAdsApi.getTokenStatus()
      setTokenStatus(status)
    } catch (err) {
      console.error('Failed to load token status:', err)
    }
  }, [])

  useEffect(() => {
    loadTokenStatus()
  }, [loadTokenStatus])

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return
    setSavingToken(true)
    setTokenMessage(null)
    try {
      const result = await wbAdsApi.saveToken(tokenInput.trim())
      if (result.success) {
        setTokenMessage({ type: 'success', text: 'Токен сохранён' })
        setTokenInput('')
        setTokenStatus({ hasToken: result.hasToken, maskedToken: result.maskedToken })
        setTimeout(() => setTokenMessage(null), 3000)
      }
    } catch (err: any) {
      setTokenMessage({ type: 'error', text: err.response?.data?.error || 'Ошибка сохранения токена' })
    } finally {
      setSavingToken(false)
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [analyticsData, notesData, statusData] = await Promise.all([
        wbAdsApi.getAnalytics({ startDate, endDate, nmId: selectedNmId }),
        wbAdsApi.getNotes({ startDate, endDate }),
        wbAdsApi.getSyncStatus(),
      ])
      setAnalytics(analyticsData)
      setNotes(notesData)
      setSyncStatus(statusData)
    } catch (err) {
      console.error('Failed to load WB ads data:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedNmId])

  const loadArticles = useCallback(async () => {
    try {
      const data = await wbAdsApi.getArticles()
      setArticles(data)
    } catch (err) {
      console.error('Failed to load articles:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await wbAdsApi.syncStats(startDate, endDate)
      showToast(`Синхронизация завершена: ${result.message}`)
      await loadData()
    } catch (err: any) {
      showToast('Ошибка синхронизации: ' + (err.response?.data?.error || err.message), 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveNote = async (date: string) => {
    if (!noteText.trim()) return
    try {
      const existing = notes.find(n => n.date.split('T')[0] === date)
      if (existing) {
        await wbAdsApi.updateNote(existing.id, noteText)
      } else {
        await wbAdsApi.createNote({ date, content: noteText })
      }
      setEditingNoteDate(null)
      setNoteText('')
      const updatedNotes = await wbAdsApi.getNotes({ startDate, endDate })
      setNotes(updatedNotes)
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      await wbAdsApi.deleteNote(noteId)
      const updatedNotes = await wbAdsApi.getNotes({ startDate, endDate })
      setNotes(updatedNotes)
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const getNoteForDate = (dateStr: string): WbAdNote | undefined => {
    return notes.find(n => n.date.split('T')[0] === dateStr)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Megaphone className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Реклама WB</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input-date"
            />
            <span className="text-brand-text-secondary text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="input-date"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синк...' : 'Синхронизация'}
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && syncStatus.lastDate && (
        <div className="text-sm text-brand-text-secondary">
          Последняя синхронизация: {new Date(syncStatus.lastDate).toLocaleDateString('ru-RU')} | Дней в базе: {syncStatus.daysCount}
        </div>
      )}

      {/* Token Settings */}
      <div className="card !p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary-500" />
            <span className="text-sm font-medium text-brand-text">API-токен Wildberries</span>
            {tokenStatus?.hasToken ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle className="h-3 w-3" /> Подключён
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> Не задан
              </span>
            )}
          </div>
          {tokenStatus?.maskedToken && (
            <span className="text-xs text-brand-text-secondary font-mono">
              {tokenStatus.maskedToken}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Вставьте токен из ЛК Wildberries"
              className="input !w-full !pr-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={handleSaveToken}
            disabled={savingToken || !tokenInput.trim()}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            {savingToken ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>

        {tokenMessage && (
          <div className={`text-sm ${tokenMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {tokenMessage.text}
          </div>
        )}

        {/* Instructions */}
        <div>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors"
          >
            {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Как получить токен и какие нужны разрешения?
          </button>

          {showInstructions && (
            <div className="mt-2 p-3 bg-primary-50/50 rounded-xl text-xs text-brand-text space-y-2">
              <p className="font-medium">Инструкция по созданию API-токена:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-brand-text-secondary">
                <li>Перейдите в <span className="font-medium text-brand-text">Личный кабинет WB</span> → <span className="font-medium text-brand-text">Настройки</span> → <span className="font-medium text-brand-text">Доступ к API</span></li>
                <li>Нажмите <span className="font-medium text-brand-text">«Создать новый токен»</span></li>
                <li>Укажите имя (например, «XimFinance Реклама»)</li>
                <li>
                  <span className="font-medium text-brand-text">Обязательные разрешения:</span>
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li><span className="font-semibold text-primary-700">Продвижение</span> — доступ к данным рекламных кампаний (кампании, статистика, бюджеты)</li>
                    <li><span className="font-semibold text-primary-700">Статистика</span> — доступ к аналитике и отчётам (нужен для расширенных данных о выкупах)</li>
                  </ul>
                </li>
                <li>Остальные разрешения не требуются — оставьте их отключёнными</li>
                <li>Нажмите <span className="font-medium text-brand-text">«Создать токен»</span> и скопируйте его</li>
              </ol>
              <div className="mt-2 p-2 bg-amber-50 rounded-lg text-amber-700">
                <span className="font-medium">Важно:</span> токен действителен 180 дней. После истечения создайте новый и обновите его здесь.
                Токен хранится только в оперативной памяти сервера и сбрасывается при перезапуске.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Article Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedNmId(undefined)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            selectedNmId === undefined
              ? 'bg-primary-500 text-white'
              : 'bg-white border border-brand-border text-brand-text-secondary hover:bg-brand-surface'
          }`}
        >
          Сводная
        </button>
        {articles.map(a => (
          <button
            key={a.nm_id}
            onClick={() => setSelectedNmId(a.nm_id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedNmId === a.nm_id
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-brand-border text-brand-text-secondary hover:bg-brand-surface'
            }`}
          >
            {a.nm_id}
          </button>
        ))}
      </div>

      {/* Pivot Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : analytics && analytics.dates.length > 0 ? (
        <div className="card !p-0 overflow-hidden relative">
          <div className="pivot-mask-left" style={{ left: 240 }} />
          <div className="overflow-x-auto pivot-scroll">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text sticky left-0 bg-gray-50 z-20 min-w-[140px] border-r border-brand-border">
                    Метрика
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-brand-text sticky left-[140px] bg-primary-50 z-20 min-w-[100px] whitespace-nowrap ">
                    Итого
                  </th>
                  {analytics.dates.map(date => (
                    <th key={date} className="text-left py-3 px-3 font-medium text-brand-text whitespace-nowrap min-w-[90px]">
                      {formatShortDate(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((metric, idx) => {
                  const values = analytics.metrics[metric.key] || []
                  const summary = computeSummary(values, metric.agg)
                  const isEven = idx % 2 === 0
                  const stickyBg = isEven ? 'bg-white' : 'bg-[#fafafb]'
                  const summaryBg = isEven ? 'bg-[#f3f0ff]' : 'bg-[#edeafc]'

                  return (
                    <tr
                      key={metric.key}
                      className={`border-b border-gray-100 ${isEven ? '' : 'bg-[#fafafb]'} hover:bg-primary-50/30 transition-colors`}
                    >
                      <td className={`py-2.5 px-4 font-medium text-brand-text sticky left-0 z-20 ${stickyBg} border-r border-brand-border`}>
                        {metric.label}
                      </td>
                      <td className={`py-2.5 px-3 font-semibold text-brand-text sticky left-[140px] z-20 ${summaryBg} tabular-nums whitespace-nowrap `}>
                        {formatMetricValue(summary, metric.format)}
                      </td>
                      {values.map((val, i) => (
                        <td key={i} className="text-left py-2.5 px-3 text-brand-text-secondary tabular-nums whitespace-nowrap">
                          {formatMetricValue(val, metric.format)}
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {/* Notes row */}
                <tr className="border-t-2 border-brand-border bg-amber-50/30">
                  <td className="py-2.5 px-4 font-medium text-brand-text sticky left-0 bg-[#fef9ee] z-20 border-r border-brand-border">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Заметки
                    </div>
                  </td>
                  <td className="sticky left-[140px] bg-[#fef9ee] z-20 " />
                  {analytics.dates.map(date => {
                    const note = getNoteForDate(date)
                    const isEditing = editingNoteDate === date

                    return (
                      <td key={date} className="text-center py-1.5 px-1 relative">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <textarea
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              className="w-full text-xs border border-primary-300 rounded p-1 resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleSaveNote(date)}
                                className="text-xs text-primary-600 hover:text-primary-800"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => { setEditingNoteDate(null); setNoteText('') }}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : note ? (
                          <div className="group relative">
                            <button
                              onClick={() => { setEditingNoteDate(date); setNoteText(note.content) }}
                              className="text-amber-600 hover:text-amber-800"
                              title={note.content}
                            >
                              <MessageSquare className="h-4 w-4 mx-auto fill-amber-200" />
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-48 p-2 bg-white rounded-lg shadow-lg border text-xs text-left text-brand-text">
                              {note.content}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id) }}
                                className="block mt-1 text-red-500 hover:text-red-700 text-[10px]"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingNoteDate(date); setNoteText('') }}
                            className="text-gray-300 hover:text-gray-500"
                          >
                            <MessageSquare className="h-4 w-4 mx-auto" />
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-brand-text-secondary">
            {analytics && analytics.dates.length === 0
              ? 'Нет данных за выбранный период. Нажмите «Синхронизация» для загрузки из WB.'
              : 'Загрузка данных...'}
          </p>
        </div>
      )}
    </div>
  )
}

export default WbAdsAnalytics
