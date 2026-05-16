import { useEffect, useState } from 'react'
import { publicationsApi } from '../../api/contentBank'

interface PulseData {
  scheduled_today: number
  published_today: number
  avg_published_7d: number
}

/**
 * Tiny single-line activity strip in the content-bank header:
 *   Пульс: 📌 4 запланировано · ✅ 2 опубликовано (▲ 33% к среднему за 7 дн.)
 *
 * Fetches /api/content-publications/pulse on mount. Silent fail (no toast)
 * since this is decorative — if the endpoint hiccups, just hides the strip.
 */
export function Pulse() {
  const [data, setData] = useState<PulseData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    publicationsApi
      .pulse()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed || !data) return null

  const { scheduled_today, published_today, avg_published_7d } = data
  // Delta vs the 7-day daily average. Hidden if avg is 0 (no signal yet).
  let deltaPart: React.ReactNode = null
  if (avg_published_7d > 0) {
    const delta = published_today - avg_published_7d
    const deltaPct = Math.round((delta / avg_published_7d) * 100)
    const up = delta >= 0
    deltaPart = (
      <span className={'ml-1 ' + (up ? 'text-green-600' : 'text-red-600')}>
        ({up ? '▲' : '▼'} {Math.abs(deltaPct)}% к среднему за 7 дн.)
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
      <span className="font-medium text-brand-text">Пульс:</span>
      <span>📌 {scheduled_today} запланировано</span>
      <span>·</span>
      <span>
        ✅ {published_today} опубликовано
        {deltaPart}
      </span>
    </div>
  )
}
