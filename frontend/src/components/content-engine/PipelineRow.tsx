import { StageKey } from '../../api/contentEngine'

interface Props {
  counts: Record<StageKey, number>
  openStage: StageKey | null
  onStageClick: (s: StageKey) => void
}

const STAGES: Array<{ key: StageKey; label: string; emoji: string; classes: string }> = [
  { key: 'ideas',             label: 'Идеи',           emoji: '💡', classes: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { key: 'triage_needs_work', label: 'Триаж',          emoji: '✏️', classes: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
  { key: 'excellent',         label: 'Excellent',      emoji: '✓',  classes: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
  { key: 'planning',          label: 'Планирование',   emoji: '🗓', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'scripting',         label: 'Сценарий',       emoji: '📝', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'voiceover_prep',    label: 'Озвучка',        emoji: '🎤', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'production',        label: 'Видео',          emoji: '🎬', classes: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' },
  { key: 'published',         label: 'Опубликовано',   emoji: '✓',  classes: 'bg-subtle border-brand-border text-brand-text-secondary hover:bg-brand-border/30' },
  { key: 'rejected',          label: 'Отказ',          emoji: '✕',  classes: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' },
]

export function PipelineRow({ counts, openStage, onStageClick }: Props) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wider text-brand-text-secondary mb-1.5">
        Конвейер
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5">
        {STAGES.map((s) => {
          const isOpen = openStage === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onStageClick(s.key)}
              className={
                'flex items-center justify-between gap-2 py-2 px-3 rounded-xl border transition-colors ' +
                s.classes +
                (isOpen ? ' ring-2 ring-primary-300' : '')
              }
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm leading-none">{s.emoji}</span>
                <span className="text-xs font-medium truncate">{s.label}</span>
              </span>
              <span className="text-base font-bold leading-none shrink-0">{counts[s.key] ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
