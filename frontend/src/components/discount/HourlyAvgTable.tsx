import { useMemo } from 'react'
import type { PriceHourlyRow, DiscountPlatform } from '../../api/discountTracker'

/** Средняя СПП за час, пивот час×артикул. Ячейка — среднее platform_pct (%) до 0.1. */
const cellColor = (pct: number | null): string => {
  if (pct == null) return 'text-brand-text-secondary/50'
  const v = pct * 100
  if (v >= 10) return 'text-green-600'
  if (v >= 5) return 'text-amber-500'
  return 'text-red-600'
}

const fmtPct = (pct: number | null): string => (pct == null ? '—' : `${(pct * 100).toFixed(1)}%`)

const fmtHour = (iso: string): string => {
  const d = new Date(iso)
  const day = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  const hh = String(d.getHours()).padStart(2, '0')
  return `${day} ${hh}:00`
}

const colKey = (p: DiscountPlatform, sku: string) => `${p}:${sku}`

interface Props {
  rows: PriceHourlyRow[]
  platform?: DiscountPlatform | 'all'
}

export const HourlyAvgTable = ({ rows, platform = 'all' }: Props) => {
  const data = useMemo(() => rows.filter(r => platform === 'all' || r.platform === platform), [rows, platform])

  const { cols, hours, pivot } = useMemo(() => {
    const colsMap = new Map<string, { platform: DiscountPlatform; sku: string; name: string }>()
    const hoursSet = new Set<string>()
    const pv = new Map<string, PriceHourlyRow>() // `${hour}|${colKey}` → row
    for (const r of data) {
      const ck = colKey(r.platform, r.sku)
      if (!colsMap.has(ck)) colsMap.set(ck, { platform: r.platform, sku: r.sku, name: r.product_name })
      hoursSet.add(r.hour)
      pv.set(`${r.hour}|${ck}`, r)
    }
    const colsArr = [...colsMap.entries()]
      .map(([ck, v]) => ({ ck, ...v }))
      .sort((a, b) => (a.platform === b.platform ? a.sku.localeCompare(b.sku) : a.platform.localeCompare(b.platform)))
    const hoursArr = [...hoursSet].sort((a, b) => b.localeCompare(a)) // свежие сверху
    return { cols: colsArr, hours: hoursArr, pivot: pv }
  }, [data])

  if (!cols.length) {
    return (
      <p className="py-6 text-center text-sm text-brand-text-secondary">
        Почасовых данных пока нет — появятся после нескольких 5-минутных замеров.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-left">
            <th className="py-2 pr-4 font-semibold text-brand-text-secondary whitespace-nowrap">Час</th>
            {cols.map(c => (
              <th key={c.ck} className="px-3 py-2 text-right font-semibold text-brand-text whitespace-nowrap">
                <span className="block max-w-[160px] truncate" title={`${c.name} (${c.platform.toUpperCase()} ${c.sku})`}>
                  {c.name}
                </span>
                <span className="block font-mono text-[10px] font-normal text-brand-text-secondary/70">
                  {c.platform.toUpperCase()} {c.sku}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map(h => (
            <tr key={h} className="border-b border-brand-border/50">
              <td className="py-1.5 pr-4 tabular-nums text-brand-text-secondary whitespace-nowrap">{fmtHour(h)}</td>
              {cols.map(c => {
                const cell = pivot.get(`${h}|${c.ck}`)
                return (
                  <td
                    key={c.ck}
                    className={`px-3 py-1.5 text-right tabular-nums font-semibold ${cellColor(cell?.avg_platform_pct ?? null)}`}
                    title={cell ? `${cell.samples} замеров · витрина ${cell.avg_shelf_price?.toFixed(0)}₽` : 'нет данных'}
                  >
                    {fmtPct(cell?.avg_platform_pct ?? null)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
