import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Percent } from 'lucide-react'
import {
  fetchPublicSpp, fetchPublicSppMatrix, PublicSppData, SppMatrixRow, DiscountPlatform,
} from '../api/discountTracker'
import { SppDailyView } from '../components/discount/SppDailyView'
import { SppMatrix } from '../components/discount/SppMatrix'

const REFRESH_MS = 30 * 60_000 // дневные данные — обновлять раз в 30 мин достаточно

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const PublicSpp = () => {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicSppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<DiscountPlatform>('wb')
  const [matrixRows, setMatrixRows] = useState<SppMatrixRow[]>([])
  const [matrixLoading, setMatrixLoading] = useState(true)

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

  // сводная матрица — отдельно, реагирует на переключатель платформы
  useEffect(() => {
    if (!token) return
    let alive = true
    setMatrixLoading(true)
    fetchPublicSppMatrix(token, platform, 30)
      .then((d) => { if (alive) setMatrixRows(d.rows) })
      .catch(() => { if (alive) setMatrixRows([]) })
      .finally(() => { if (alive) setMatrixLoading(false) })
    return () => { alive = false }
  }, [token, platform])

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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Percent className="h-7 w-7 text-[#836efe]" />
            <h1 className="text-2xl font-bold text-[#1c1528]">Фактическая СПП — Ximi4ka</h1>
          </div>
          <div className="text-sm text-[#524667]">Обновлено {fmtTime(data.generated_at)}</div>
        </div>

        {/* Сводная матрица: артикул × дата */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1c1528]">Сводная СПП: артикул × дата (30 дней)</h2>
              <p className="mt-1 text-xs text-[#524667]">
                {platform === 'wb'
                  ? 'ВБ — фактическая СПП по реальным заказам (средняя за день).'
                  : 'Озон — скидка площадки из витринных снапшотов (дневное среднее).'}
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-[#e8e5ef] bg-white p-0.5">
              {(['wb', 'ozon'] as DiscountPlatform[]).map((p) => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${platform === p ? 'bg-[#836efe] text-white' : 'text-[#524667] hover:text-[#1c1528]'}`}>
                  {p === 'wb' ? 'ВБ' : 'Озон'}
                </button>
              ))}
            </div>
          </div>
          {matrixLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin h-8 w-8 border-4 border-[#836efe] border-t-transparent rounded-full" />
            </div>
          ) : (
            <SppMatrix rows={matrixRows} />
          )}
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
