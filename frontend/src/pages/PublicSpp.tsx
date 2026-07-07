import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Percent } from 'lucide-react'
import { fetchPublicSpp, PublicSppData } from '../api/discountTracker'
import { SppDailyView } from '../components/discount/SppDailyView'

const REFRESH_MS = 30 * 60_000 // дневные данные — обновлять раз в 30 мин достаточно

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const PublicSpp = () => {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicSppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Ссылка недействительна')
      setLoading(false)
      return
    }
    let alive = true
    const load = async () => {
      try {
        const result = await fetchPublicSpp(token, 30)
        if (alive) {
          setData(result)
          setError(null)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Ошибка загрузки')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeebf3] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-[#836efe] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#524667]">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#eeebf3] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-10 text-center max-w-md w-full">
          <Percent className="h-12 w-12 text-[#836efe] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1c1528] mb-2">Данные недоступны</h2>
          <p className="text-[#524667]">{error ?? 'Эта ссылка недействительна.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eeebf3] py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Percent className="h-7 w-7 text-[#836efe]" />
            <h1 className="text-2xl font-bold text-[#1c1528]">Фактическая СПП — Ximi4ka</h1>
          </div>
          <div className="text-sm text-[#524667]">Обновлено {fmtTime(data.generated_at)}</div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1c1528]">СПП по фактическим заказам (30 дней)</h2>
            <p className="mt-1 text-xs text-[#524667]">
              Расчёт по реальным выкупам: разница между ценой продавца и ценой, которую заплатил покупатель. Средняя,
              медиана и разброс (min–max) — что реально видят покупатели.
            </p>
          </div>
          <SppDailyView rows={data.daily} platform="wb" />
        </div>
      </div>
    </div>
  )
}

export default PublicSpp
