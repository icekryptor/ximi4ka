import { useMemo } from 'react'
import type { PriceHourlyRow, DiscountPlatform } from '../../api/discountTracker'

/**
 * Тепловая карта почасового среднего СПП: строки — артикулы, столбцы — часы.
 * Аккуратные скруглённые плитки с зазором (не сплошная квадратная заливка),
 * значение внутри, цвет — от красного (низкая субсидия) к зелёному (высокая).
 */

// 0% → красный, ~20% → жёлтый, ≥40% → зелёный. Мягкая насыщенность для читабельности.
const heatColor = (pct: number): string => {
  const hue = Math.max(0, Math.min(120, (pct / 40) * 120))
  return `hsl(${hue}, 62%, 58%)`
}

const colKey = (p: DiscountPlatform, sku: string) => `${p}:${sku}`

const hourLabel = (iso: string): string => String(new Date(iso).getHours()).padStart(2, '0')
const dayLabel = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  rows: PriceHourlyRow[]
  platform?: DiscountPlatform | 'all'
}

export const HourlyHeatmap = ({ rows, platform = 'all' }: Props) => {
  const data = useMemo(
    () => rows.filter((r) => platform === 'all' || r.platform === platform),
    [rows, platform],
  )

  const { skus, hours, pivot } = useMemo(() => {
    const skuMap = new Map<string, { platform: DiscountPlatform; sku: string; name: string }>()
    const hoursSet = new Set<string>()
    const pv = new Map<string, PriceHourlyRow>()
    for (const r of data) {
      const ck = colKey(r.platform, r.sku)
      if (!skuMap.has(ck)) skuMap.set(ck, { platform: r.platform, sku: r.sku, name: r.product_name })
      hoursSet.add(r.hour)
      pv.set(`${r.hour}|${ck}`, r)
    }
    const skusArr = [...skuMap.entries()]
      .map(([ck, v]) => ({ ck, ...v }))
      .sort((a, b) => (a.platform === b.platform ? a.sku.localeCompare(b.sku) : a.platform.localeCompare(b.platform)))
    const hoursArr = [...hoursSet].sort((a, b) => a.localeCompare(b)) // старые слева → свежие справа
    return { skus: skusArr, hours: hoursArr, pivot: pv }
  }, [data])

  if (!skus.length || !hours.length) {
    return (
      <p className="py-6 text-center text-sm text-[#524667]">
        Почасовых данных пока нет — появятся после нескольких 5-минутных замеров.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Шапка: даты + часы */}
          <div className="flex">
            <div className="w-40 shrink-0" />
            <div className="flex gap-1">
              {hours.map((h, i) => {
                const showDay = i === 0 || dayLabel(h) !== dayLabel(hours[i - 1])
                return (
                  <div key={h} className="w-9 shrink-0 text-center">
                    <div className="h-3 text-[9px] font-medium text-[#524667]/70">
                      {showDay ? dayLabel(h) : ''}
                    </div>
                    <div className="text-[10px] tabular-nums text-[#524667]">{hourLabel(h)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Строки по артикулам */}
          <div className="mt-1 space-y-1">
            {skus.map((s) => (
              <div key={s.ck} className="flex items-center">
                <div className="w-40 shrink-0 pr-2">
                  <div className="truncate text-xs font-medium text-[#1c1528]" title={s.name}>
                    {s.name}
                  </div>
                  <div className="truncate font-mono text-[10px] text-[#524667]/70">{s.sku}</div>
                </div>
                <div className="flex gap-1">
                  {hours.map((h) => {
                    const cell = pivot.get(`${h}|${s.ck}`)
                    const pct = cell?.avg_platform_pct != null ? cell.avg_platform_pct * 100 : null
                    return (
                      <div
                        key={h}
                        className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ring-1 ring-inset ring-black/5"
                        style={
                          pct == null
                            ? { backgroundColor: '#f1eef6', color: '#a9a2b8' }
                            : { backgroundColor: heatColor(pct), color: '#1c1528' }
                        }
                        title={
                          cell
                            ? `${dayLabel(h)} ${hourLabel(h)}:00 — ${pct!.toFixed(1)}% · ${cell.samples} замеров`
                            : 'нет данных'
                        }
                      >
                        {pct == null ? '·' : pct.toFixed(1)}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-2 text-xs text-[#524667]">
        <span>Ниже</span>
        {[0, 20, 40].map((p) => (
          <span
            key={p}
            className="inline-block h-4 w-6 rounded-md ring-1 ring-inset ring-black/5"
            style={{ backgroundColor: heatColor(p) }}
          />
        ))}
        <span>Выше — доля площадки (СПП, %)</span>
      </div>
    </div>
  )
}
