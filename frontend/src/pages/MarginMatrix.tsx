import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { economicsApi, MarginMatrixResponse } from '../api/economics'

const rub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(v)

const marginColor = (pct: number) => {
  if (pct >= 30) return 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950'
  if (pct >= 15) return 'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950'
  if (pct >= 0) return 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950'
  return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950'
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
    <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/3" /><div className="h-96 bg-muted rounded" /></div></div>
  )

  if (!data || data.rows.length === 0) return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-brand-text mb-2">Матрица маржинальности</h1>
      <p className="text-brand-text-secondary">Нет данных. Добавьте наборы и каналы продаж для расчёта.</p>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Матрица маржинальности</h1>
          <p className="text-brand-text-secondary mt-1">Все SKU × все каналы продаж</p>
        </div>
        <button onClick={load} className="btn flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /><span>Обновить</span>
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left py-3 px-4 font-semibold text-brand-text-secondary sticky left-0 bg-card z-10">SKU</th>
              <th className="text-right py-3 px-4 font-semibold text-brand-text-secondary">Себестоимость</th>
              {data.channels.map(ch => (
                <th key={ch.id} className="text-center py-3 px-4 font-semibold text-brand-text-secondary min-w-[160px]">{ch.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.kit_id} className="border-b border-brand-border hover:bg-subtle">
                <td className="py-3 px-4 sticky left-0 bg-card z-10">
                  <div className="font-medium text-brand-text">{row.kit_name}</div>
                  {row.sku && <div className="text-xs text-brand-text-secondary">{row.sku}</div>}
                </td>
                <td className="text-right py-3 px-4 text-brand-text-secondary">{rub(row.cost_price)}</td>
                {row.channels.map(ch => (
                  <td key={ch.channel_id} className="py-3 px-4 text-center">
                    {ch.selling_price > 0 ? (
                      <div className="space-y-1">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${marginColor(ch.margin_pct)}`}>
                          <MarginIcon pct={ch.margin_pct} />
                          {ch.margin_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-brand-text-secondary">{rub(ch.unit_margin)}</div>
                      </div>
                    ) : (
                      <span className="text-brand-text-secondary">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-brand-text-secondary">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900 inline-block" /> ≥30% отлично</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900 inline-block" /> 15-30% нормально</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900 inline-block" /> 0-15% внимание</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900 inline-block" /> &lt;0% убыток</span>
      </div>
    </div>
  )
}

export default MarginMatrix
