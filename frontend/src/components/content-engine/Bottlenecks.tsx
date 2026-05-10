import { AlertTriangle } from 'lucide-react'
import { StageKey } from '../../api/contentEngine'

interface Props {
  counts: Record<StageKey, number>
}

interface Warning {
  text: string
}

export function Bottlenecks({ counts }: Props) {
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
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-2">
        <AlertTriangle size={16} /> Узкие места
      </div>
      <ul className="space-y-1.5 text-sm text-amber-900">
        {warnings.map((w, i) => (
          <li key={i}>• {w.text}</li>
        ))}
      </ul>
    </div>
  )
}
