import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { economicsApi, MarginMatrixResponse } from '../api/economics'

const rub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(v)

const marginColor = (pct: number) => {
  if (pct >= 30) return 'text-green-700 bg-green-50'
  if (pct >= 15) return 'text-yellow-700 bg-yellow-50'
  if (pct >= 0) return 'text-orange-700 bg-orange-50'
  return 'text-red-700 bg-red-50'
}

const MarginIcon = ({ pct }: { pct: number }) => {
  if (pct >= 15) return <TrendingUp className="h-3.5 w-3.5" />
  if (pct >= 0) return <Minus className="h-3.5 w-3.5" />
  return <TrendingDown className="h-3.5 w-3.5" />
}

const MarginMatrix = () => {
  const [data, setData] = useState<MarginMatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setData(await economicsApi.marginMatrix())
    } catch (e) { console.error('Ошибка загрузки матрицы:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="h-96 bg-gray-200 rounded" /></div></div>
  )

  if (!data || data.rows.length === 0) return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Матрица маржинальности</h1>
      <p className="text-gray-500">Нет данных. Добавьте наборы и каналы продаж для расчёта.</p>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Матрица маржинальности</h1>
          <p className="text-gray-600 mt-1">Все SKU × все каналы продаж</p>
        </div>
        <button onClick={load} className="btn flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /><span>Обновить</span>
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 sticky left-0 bg-white z-10">SKU</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Себестоимость</th>
              {data.channels.map(ch => (
                <th key={ch.id} className="text-center py-3 px-4 font-semibold text-gray-700 min-w-[160px]">{ch.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.kit_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 sticky left-0 bg-white z-10">
                  <div className="font-medium text-gray-900">{row.kit_name}</div>
                  {row.sku && <div className="text-xs text-gray-400">{row.sku}</div>}
                </td>
                <td className="text-right py-3 px-4 text-gray-700">{rub(row.cost_price)}</td>
                {row.channels.map(ch => (
                  <td key={ch.channel_id} className="py-3 px-4 text-center">
                    {ch.selling_price > 0 ? (
                      <div className="space-y-1">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${marginColor(ch.margin_pct)}`}>
                          <MarginIcon pct={ch.margin_pct} />
                          {ch.margin_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">{rub(ch.unit_margin)}</div>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> ≥30% отлично</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 inline-block" /> 15-30% нормально</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 inline-block" /> 0-15% внимание</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> &lt;0% убыток</span>
      </div>
    </div>
  )
}

export default MarginMatrix
