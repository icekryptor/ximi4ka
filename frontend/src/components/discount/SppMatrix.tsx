import { useMemo } from 'react'
import { SppMatrixRow } from '../../api/discountTracker'

/**
 * Сводная матрица СПП: строки — артикул продавца, столбцы — даты, ячейка — СПП%.
 * Пороги: <33% красный, 33–36% жёлтый, >36% зелёный (приглушённая палитра как у ДРР).
 */
const sppColor = (v: number | null): { bg: string; fg: string } => {
  if (v == null) return { bg: 'transparent', fg: 'inherit' }
  if (v < 33) return { bg: '#ef9a9a', fg: '#7f1d1d' } // красный
  if (v <= 36) return { bg: '#ffe082', fg: '#5c4400' } // жёлтый
  return { bg: '#a5d6a7', fg: '#1b5e20' } // зелёный
}

const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

export const SppMatrix = ({ rows }: { rows: SppMatrixRow[] }) => {
  const { dates, articles, cell } = useMemo(() => {
    const dateSet = new Set<string>()
    const artMeta = new Map<string, string>() // article -> product_name
    const cell = new Map<string, number | null>() // `${article}|${date}`
    for (const r of rows) {
      const d = r.date.slice(0, 10)
      dateSet.add(d)
      if (!artMeta.has(r.article)) artMeta.set(r.article, r.product_name)
      cell.set(`${r.article}|${d}`, r.spp_pct)
    }
    const dates = [...dateSet].sort((a, b) => b.localeCompare(a)) // свежие слева
    const articles = [...artMeta.entries()]
      .map(([article, name]) => ({ article, name }))
      .sort((a, b) => a.article.localeCompare(b.article))
    return { dates, articles, cell }
  }, [rows])

  // средняя по артикулу за период (для колонки Ср.)
  const avgFor = (article: string): number | null => {
    const vals = dates.map((d) => cell.get(`${article}|${d}`)).filter((v): v is number => v != null)
    if (!vals.length) return null
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  if (!articles.length) {
    return <div className="py-8 text-center text-sm text-[#524667]">Данных за период нет.</div>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-[#524667]">
        <span>СПП:</span>
        {[{ c: '#ef9a9a', t: '<33%' }, { c: '#ffe082', t: '33–36%' }, { c: '#a5d6a7', t: '>36%' }].map((x) => (
          <span key={x.t} className="flex items-center gap-1">
            <span className="inline-block h-3.5 w-5 rounded ring-1 ring-inset ring-black/5" style={{ backgroundColor: x.c }} />
            {x.t}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#e8e5ef] text-left text-[#524667]">
              <th className="py-1.5 pr-2 font-semibold whitespace-nowrap sticky left-0 bg-white">Артикул</th>
              <th className="py-1.5 px-1.5 font-semibold text-center whitespace-nowrap">Ср.</th>
              {dates.map((d) => (
                <th key={d} className="py-1.5 px-1.5 font-semibold text-center whitespace-nowrap">{dayLabel(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {articles.map(({ article, name }) => {
              const avg = avgFor(article)
              const ac = sppColor(avg)
              return (
                <tr key={article} className="border-b border-[#e8e5ef]/60">
                  <td className="py-1 pr-2 sticky left-0 bg-white">
                    <span className="font-mono font-semibold text-[#1c1528]">{article}</span>
                    {name && name !== article && (
                      <span className="ml-1.5 hidden max-w-[160px] truncate align-middle text-[10px] text-[#524667]/70 sm:inline-block" title={name}>{name}</span>
                    )}
                  </td>
                  <td className="py-1 px-1 text-center">
                    <span className="inline-flex min-w-[2.6rem] items-center justify-center rounded px-1 py-0.5 font-semibold tabular-nums ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: ac.bg, color: ac.fg }}>
                      {avg == null ? '—' : `${avg.toFixed(1)}%`}
                    </span>
                  </td>
                  {dates.map((d) => {
                    const v = cell.get(`${article}|${d}`) ?? null
                    const c = sppColor(v)
                    return (
                      <td key={d} className="py-1 px-1 text-center">
                        <span className="inline-flex min-w-[2.6rem] items-center justify-center rounded px-1 py-0.5 font-semibold tabular-nums ring-1 ring-inset ring-black/5"
                          style={{ backgroundColor: c.bg, color: c.fg }}>
                          {v == null ? '·' : `${v.toFixed(1)}%`}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
