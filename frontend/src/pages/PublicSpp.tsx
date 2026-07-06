import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Percent } from 'lucide-react'
import { fetchPublicSpp, PublicSppData, PriceLatestRow } from '../api/discountTracker'
import { HourlyHeatmap } from '../components/discount/HourlyHeatmap'

const REFRESH_MS = 5 * 60_000

const fmtMoney = (v: number | null): string =>
  v == null ? '—' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`

const fmtPct = (v: number | null): string => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

const pctColor = (v: number | null): string => {
  if (v == null) return 'text-[#524667]'
  const p = v * 100
  if (p >= 10) return 'text-green-600'
  if (p >= 5) return 'text-amber-500'
  return 'text-red-600'
}

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const LatestTable = ({ rows }: { rows: PriceLatestRow[] }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-[#e8e5ef] text-left text-[#524667]">
          <th className="py-2 pr-4 font-semibold whitespace-nowrap">Платформа</th>
          <th className="py-2 pr-4 font-semibold">Товар</th>
          <th className="py-2 pr-4 font-semibold text-right whitespace-nowrap">Цена продавца</th>
          <th className="py-2 pr-4 font-semibold text-right whitespace-nowrap">Витрина</th>
          <th className="py-2 pr-4 font-semibold text-right whitespace-nowrap">Субсидия площадки</th>
          <th className="py-2 font-semibold text-right whitespace-nowrap">СПП / соинвест</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={`${r.platform}:${r.sku}`} className="border-b border-[#e8e5ef]/60 last:border-0">
            <td className="py-2 pr-4">
              <span className="inline-block rounded-md bg-[#eeebf3] px-2 py-0.5 text-xs font-semibold text-[#6703ff]">
                {r.platform.toUpperCase()}
              </span>
            </td>
            <td className="py-2 pr-4">
              <span className="block max-w-[280px] truncate text-[#1c1528]" title={r.product_name}>
                {r.product_name}
              </span>
              <span className="block font-mono text-[10px] text-[#524667]/70">{r.sku}</span>
            </td>
            <td className="py-2 pr-4 text-right tabular-nums text-[#1c1528]">{fmtMoney(r.seller_price)}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-[#1c1528]">{fmtMoney(r.shelf_price)}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-[#1c1528]">{fmtMoney(r.platform_disc)}</td>
            <td className={`py-2 text-right tabular-nums font-bold ${pctColor(r.platform_pct)}`}>
              {fmtPct(r.platform_pct)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

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
        const result = await fetchPublicSpp(token)
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Percent className="h-7 w-7 text-[#836efe]" />
            <h1 className="text-2xl font-bold text-[#1c1528]">СПП / соинвест — Ximi4ka</h1>
          </div>
          <div className="text-sm text-[#524667]">
            Обновлено {fmtTime(data.generated_at)} · автообновление каждые 5 мин
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-6 space-y-3">
          <h2 className="text-sm font-semibold text-[#1c1528]">Текущие значения</h2>
          <LatestTable rows={data.latest} />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-[#e8e5ef] p-6 space-y-3">
          <h2 className="text-sm font-semibold text-[#1c1528]">Почасовое среднее СПП (24 ч)</h2>
          <HourlyHeatmap rows={data.hourly} />
        </div>

        <p className="text-center text-xs text-[#524667]/70">
          Витрина снимается каждые 5 минут. СПП = 1 − витрина / цена продавца.
        </p>
      </div>
    </div>
  )
}

export default PublicSpp
