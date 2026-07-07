import { useCallback, useEffect, useState } from 'react'
import { Percent, RefreshCw } from 'lucide-react'
import { discountTrackerApi, DiscountPlatform, SppDailyRow } from '../api/discountTracker'
import { SppDailyView } from '../components/discount/SppDailyView'
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

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await discountTrackerApi.sppSync(14)
      toast.success('Синхронизация запущена — данные обновятся через ~минуту')
      // WB /orders лимит 1 req/min — подтянем результат позже
      setTimeout(() => {
        loadData()
        setSyncing(false)
      }, 75_000)
    } catch (err: any) {
      toast.error('Ошибка синка: ' + (err.response?.data?.error || err.message))
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Percent className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Трекер СПП (по заказам)</h1>
        </div>
        <button onClick={handleSync} disabled={syncing} className="btn btn-primary flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизирую...' : 'Собрать сейчас'}
        </button>
      </div>

      <div className="text-sm text-brand-text-secondary">
        Фактическая СПП по реальным заказам WB: разница между ценой продавца и ценой покупателя. Обновляется из отчёта
        заказов несколько раз в день (клик по дню — распределение по заказам и регионам).
      </div>

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
    </div>
  )
}

export default DiscountTracker
