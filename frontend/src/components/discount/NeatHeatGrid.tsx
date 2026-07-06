import { useMemo } from 'react'

/**
 * Презентационная тепловая сетка: столбцы — дни, строки — часы (00:00…23:00).
 * Аккуратные скруглённые плитки с зазором и обводкой, значение внутри (0.1%),
 * цвет от красного (низкая СПП) к зелёному (высокая). Переиспользуется публичной
 * страницей и админкой — палитра через brand-* (адаптируется под тёмную тему).
 */

export interface HeatPoint {
  day: string // dayKey `YYYY-MM-DD`
  hour: number // 0..23 (локальный час)
  pct: number // доля площадки в процентах (напр. 32.4)
  samples?: number
}

const heatColor = (pct: number): string => {
  const hue = Math.max(0, Math.min(120, (pct / 40) * 120))
  return `hsl(${hue}, 62%, 58%)`
}

const dayHeader = (key: string): string => {
  const [, m, d] = key.split('-')
  return `${d}.${m}`
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

export const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const NeatHeatGrid = ({ points, emptyHint }: { points: HeatPoint[]; emptyHint?: string }) => {
  const { days, grid } = useMemo(() => {
    const g = new Map<string, HeatPoint>()
    const daySet = new Set<string>()
    for (const p of points) {
      daySet.add(p.day)
      g.set(`${p.day}|${p.hour}`, p)
    }
    return { days: [...daySet].sort(), grid: g }
  }, [points])

  if (!days.length) {
    return (
      <p className="py-6 text-center text-sm text-brand-text-secondary">
        {emptyHint ?? 'Нет данных за период'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* Шапка: дни */}
          <div className="flex">
            <div className="w-14 shrink-0" />
            <div className="flex gap-1">
              {days.map((d) => (
                <div
                  key={d}
                  className="w-12 shrink-0 text-center text-[10px] font-medium text-brand-text-secondary/80"
                >
                  {dayHeader(d)}
                </div>
              ))}
            </div>
          </div>

          {/* Строки: часы */}
          <div className="mt-1 space-y-1">
            {HOURS.map((h) => (
              <div key={h} className="flex items-center">
                <div className="w-14 shrink-0 pr-2 text-right text-[10px] tabular-nums text-brand-text-secondary/80">
                  {String(h).padStart(2, '0')}:00
                </div>
                <div className="flex gap-1">
                  {days.map((d) => {
                    const cell = grid.get(`${d}|${h}`)
                    return (
                      <div
                        key={d}
                        className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums ring-1 ring-inset ring-black/5"
                        style={
                          cell
                            ? { backgroundColor: heatColor(cell.pct), color: '#1c1528' }
                            : { backgroundColor: 'rgba(124,114,148,0.08)', color: '#a9a2b8' }
                        }
                        title={
                          cell
                            ? `${dayHeader(d)} ${String(h).padStart(2, '0')}:00 — ${cell.pct.toFixed(1)}%${
                                cell.samples ? ` · ${cell.samples} замеров` : ''
                              }`
                            : 'нет данных'
                        }
                      >
                        {cell ? cell.pct.toFixed(1) : '·'}
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
      <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
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
