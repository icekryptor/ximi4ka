import { useCallback, useEffect, useState } from 'react'
import { Percent, RefreshCw, Grid3x3, Share2 } from 'lucide-react'
import { discountTrackerApi, DiscountPlatform, SppDailyRow, SppMatrixRow } from '../api/discountTracker'
import { SppDailyView } from '../components/discount/SppDailyView'
import { SppMatrix } from '../components/discount/SppMatrix'
import { useToast } from '../contexts/ToastContext'

type PlatformFilter = 'all' | DiscountPlatform

const PLATFORM_FILTERS: Array<{ value: PlatformFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'wb', label: 'WB' },
  { value: 'ozon', label: 'Ozon' },
]

const DiscountTracker = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [rows, setRows] = useState<SppDailyRow[]>([])
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [view, setView] = useState<'matrix' | 'daily'>('matrix')
  const [matrixPlatform, setMatrixPlatform] = useState<DiscountPlatform>('wb')
  const [matrixRows, setMatrixRows] = useState<SppMatrixRow[]>([])
  const [matrixLoading, setMatrixLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await discountTrackerApi.sppDaily(undefined, 30))
    } catch (err) {
      console.error('Failed to load daily SPP:', err)
      toast.error('Не удалось загрузить дневную СПП')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true)
    try {
      const d = await discountTrackerApi.sppMatrix(matrixPlatform, 30)
      setMatrixRows(d.rows)
    } catch (err) {
      console.error('Failed to load SPP matrix:', err)
      toast.error('Не удалось загрузить сводную СПП')
    } finally {
      setMatrixLoading(false)
    }
  }, [matrixPlatform, toast])

  useEffect(() => {
    loadData()
  }, [loadData])
  useEffect(() => {
    loadMatrix()
  }, [loadMatrix])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await discountTrackerApi.sppSync(14)
      toast.success('Синхронизация запущена — данные обновятся через ~минуту')
      // WB /orders лимит 1 req/min — подтянем результат позже
      setTimeout(() => {
        loadData()
        loadMatrix()
        setSyncing(false)
      }, 75_000)
    } catch (err: any) {
      toast.error('Ошибка синка: ' + (err.response?.data?.error || err.message))
      setSyncing(false)
    }
  }

  const handleShare = async () => {
    try {
      const info = await discountTrackerApi.shareInfo()
      if (!info.configured || !info.path) {
        toast.error('Публичный доступ не настроен (SPP_PUBLIC_TOKEN)')
        return
      }
      const url = `${window.location.origin}${info.path}`
      await navigator.clipboard.writeText(url)
      toast.success('Публичная ссылка скопирована')
    } catch (err: any) {
      toast.error('Не удалось получить ссылку: ' + (err.response?.data?.error || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Percent className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Трекер СПП (по заказам)</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-brand-border bg-card px-3 py-2 text-sm text-brand-text-secondary hover:border-primary-300 hover:text-primary-700">
            <Share2 className="h-4 w-4" /> Поделиться
          </button>
          <button onClick={handleSync} disabled={syncing} className="btn btn-primary flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизирую...' : 'Собрать сейчас'}
          </button>
        </div>
      </div>

      <div className="text-sm text-brand-text-secondary">
        Фактическая СПП по реальным заказам WB: разница между ценой продавца и ценой покупателя. Обновляется из отчёта
        заказов несколько раз в день (клик по дню — распределение по заказам и регионам).
      </div>

      {/* Вид: сводная матрица / дневная детализация */}
      <div className="flex gap-1 rounded-xl border border-brand-border p-0.5 w-fit">
        <button onClick={() => setView('matrix')}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'matrix' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
          <Grid3x3 className="h-4 w-4" /> Сводная
        </button>
        <button onClick={() => setView('daily')}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'daily' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
          <Percent className="h-4 w-4" /> Детализация
        </button>
      </div>

      {view === 'matrix' ? (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-brand-text">Сводная СПП: артикул × дата (30 дней)</h2>
            <div className="inline-flex rounded-xl border border-brand-border bg-card p-0.5">
              {(['wb', 'ozon'] as DiscountPlatform[]).map((p) => (
                <button key={p} onClick={() => setMatrixPlatform(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${matrixPlatform === p ? 'bg-primary-500 text-white' : 'text-brand-text-secondary hover:text-brand-text'}`}>
                  {p === 'wb' ? 'ВБ' : 'Озон'}
                </button>
              ))}
            </div>
          </div>
          {matrixPlatform === 'ozon' && (
            <p className="text-xs text-brand-text-secondary">
              Озон: скидка площадки из витринных снапшотов (дневное среднее). ВБ — фактическая СПП по заказам.
            </p>
          )}
          {matrixLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <SppMatrix rows={matrixRows} />
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {PLATFORM_FILTERS.map((f) => (
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

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="card">
              <SppDailyView rows={rows} platform={filter} loadOrders={discountTrackerApi.sppOrders} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default DiscountTracker
