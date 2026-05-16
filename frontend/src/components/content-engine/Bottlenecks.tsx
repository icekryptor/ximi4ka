import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { StageKey } from '../../api/contentEngine'

interface Props {
  counts: Record<StageKey, number>
}

interface Warning {
  text: string
}

export function Bottlenecks({ counts }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click and Escape
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const warnings: Warning[] = []

  if (counts.scripting > 10) {
    warnings.push({
      text: `${counts.scripting} сценариев готовы → запусти Агента 4 (препроцессор для ElevenLabs)`,
    })
  }
  if (counts.voiceover_prep > 0) {
    warnings.push({
      text: `${counts.voiceover_prep} SKU готовы к озвучке в ElevenLabs (ручной шаг)`,
    })
  }
  if (counts.excellent > 100) {
    warnings.push({
      text: `${counts.excellent} одобренных идей в backlog (без сценариев)`,
    })
  }

  if (warnings.length === 0) return null

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border ' +
          'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 ' +
          'dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40'
        }
        aria-expanded={open}
        aria-haspopup="true"
        title="Узкие места — проблемные участки конвейера"
      >
        <AlertTriangle size={14} />
        <span className="font-medium">{warnings.length}</span>
        <span>узких мест</span>
        <span className={'transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-card border border-brand-border rounded-xl shadow-lg p-3 z-20"
          role="dialog"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
            <AlertTriangle size={14} /> Узкие места
          </div>
          <ul className="space-y-1.5 text-sm text-brand-text">
            {warnings.map((w, i) => (
              <li key={i} className="leading-snug">• {w.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
