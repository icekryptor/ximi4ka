import { useMemo, useState } from 'react'
import type { PriceHourlyRow, DiscountPlatform } from '../../api/discountTracker'
import { NeatHeatGrid, HeatPoint, dayKeyOf } from './NeatHeatGrid'

/**
 * Тепловая карта СПП для публичной страницы: артикулы — вкладками, для активного
 * артикула сетка день×час (аккуратные плитки NeatHeatGrid).
 */

const colKey = (p: DiscountPlatform, sku: string) => `${p}:${sku}`

interface Props {
  rows: PriceHourlyRow[]
  platform?: DiscountPlatform | 'all'
}

export const HourlyHeatmap = ({ rows, platform = 'all' }: Props) => {
  const data = useMemo(
    () => rows.filter((r) => platform === 'all' || r.platform === platform),
    [rows, platform],
  )

  const skus = useMemo(() => {
    const m = new Map<string, { ck: string; platform: DiscountPlatform; sku: string; name: string }>()
    for (const r of data) {
      const ck = colKey(r.platform, r.sku)
      if (!m.has(ck)) m.set(ck, { ck, platform: r.platform, sku: r.sku, name: r.product_name })
    }
    return [...m.values()].sort((a, b) => a.sku.localeCompare(b.sku))
  }, [data])

  const [active, setActive] = useState<string | null>(null)
  const activeCk = active && skus.some((s) => s.ck === active) ? active : skus[0]?.ck ?? null

  const points: HeatPoint[] = useMemo(() => {
    if (!activeCk) return []
    return data
      .filter((r) => colKey(r.platform, r.sku) === activeCk && r.avg_platform_pct != null)
      .map((r) => {
        const dt = new Date(r.hour)
        return {
          day: dayKeyOf(dt),
          hour: dt.getHours(),
          pct: (r.avg_platform_pct as number) * 100,
          samples: r.samples,
        }
      })
  }, [data, activeCk])

  if (!skus.length) {
    return (
      <p className="py-6 text-center text-sm text-brand-text-secondary">
        Почасовых данных пока нет — появятся после нескольких 5-минутных замеров.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Вкладки-артикулы */}
      <div className="flex flex-wrap gap-1.5">
        {skus.map((s) => (
          <button
            key={s.ck}
            type="button"
            onClick={() => setActive(s.ck)}
            title={`${s.name} (${s.sku})`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCk === s.ck
                ? 'bg-primary-500 text-white'
                : 'bg-[#eeebf3] text-[#524667] hover:bg-[#e3def0]'
            }`}
          >
            <span className="block max-w-[180px] truncate">{s.name}</span>
          </button>
        ))}
      </div>

      <NeatHeatGrid points={points} emptyHint="Нет данных по артикулу за период" />
    </div>
  )
}
