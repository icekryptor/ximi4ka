import { useEffect, useState } from 'react'
import { brandDocsApi } from '../../api/brandDocs'
import { parseOkr, ParsedOkr } from '../../lib/okr-parser'

const OKR_SLUG = 'okr_2026_2027'

// Module-level cache — parse once per app session, share across instances.
let okrCache: Promise<ParsedOkr> | null = null

function loadOkr(): Promise<ParsedOkr> {
  if (okrCache) return okrCache
  okrCache = brandDocsApi.get(OKR_SLUG).then((doc) => {
    if (!doc || !doc.content) {
      return { quarters: [], currentQuarterId: null }
    }
    return parseOkr(doc.content)
  }).catch(() => ({ quarters: [], currentQuarterId: null }))
  return okrCache
}

interface Props {
  value: string | null
  onChange: (krId: string | null) => void
  label?: string
}

/**
 * Hierarchical OKR KR selector. Loads OKR markdown on mount (cached after
 * first call), parses it, renders a native <select> with <optgroup> per
 * quarter. If OKR doc is missing/empty — selector is disabled but doesn't
 * block form submission.
 */
export function OkrKrSelector({ value, onChange, label = 'Привязка к OKR' }: Props) {
  const [okr, setOkr] = useState<ParsedOkr | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadOkr().then((parsed) => {
      if (!cancelled) {
        setOkr(parsed)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const hasOkr = okr && okr.quarters.length > 0
  const valueInOkr = !value || (okr?.quarters.some((q) =>
    q.objectives.some((o) => o.krs.some((kr) => kr.id === value))
  ) ?? false)

  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading || !hasOkr}
      >
        <option value="">— Не привязан —</option>
        {!loading && !hasOkr && (
          <option disabled>— OKR-документ недоступен —</option>
        )}
        {value && !valueInOkr && (
          <option value={value}>
            {value} (не найдена в текущем OKR)
          </option>
        )}
        {okr?.quarters.map((q) => (
          <optgroup key={q.id} label={q.label}>
            {q.objectives.map((o) =>
              o.krs.map((kr) => (
                <option key={kr.id} value={kr.id}>
                  {o.id.split('-').slice(-1)[0]}. {kr.text.slice(0, 80)}
                </option>
              ))
            )}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
