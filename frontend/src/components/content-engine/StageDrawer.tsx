import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { DashboardUnit, StageKey } from '../../api/contentEngine'

interface Props {
  stage: StageKey
  units: DashboardUnit[]
  onClose: () => void
}

const STAGE_LABELS: Record<StageKey, string> = {
  ideas: '💡 Идеи',
  triage_needs_work: '✏️ Требуют доработки',
  excellent: '✓ Excellent — без сценария',
  planning: '🗓 В плане публикаций',
  scripting: '📝 Со сценариями',
  voiceover_prep: '🎤 Готовы к озвучке',
  production: '🎬 Видео готово',
  published: '✓ Опубликовано',
  rejected: '✕ Отказ',
}

const COMPLEXITY_CLASSES: Record<number, string> = {
  1: 'bg-green-50 text-green-700',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-red-50 text-red-700',
}

export function StageDrawer({ stage, units, onClose }: Props) {
  const navigate = useNavigate()
  const visible = units.slice(0, 10)
  const rest = units.length - visible.length

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-text">
          {STAGE_LABELS[stage]} · {units.length}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-subtle text-brand-text-secondary"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-brand-text-secondary">Пусто</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/content-bank?search=${encodeURIComponent(u.title)}`)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-subtle transition-colors"
                >
                  <span className="text-sm">{u.rubric_emoji ?? '·'}</span>
                  <span className="flex-1 text-sm text-brand-text truncate">{u.title}</span>
                  {u.complexity && (
                    <span
                      className={
                        'text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ' +
                        (COMPLEXITY_CLASSES[u.complexity] ?? 'bg-subtle text-brand-text-secondary')
                      }
                    >
                      c{u.complexity}
                    </span>
                  )}
                  {u.scheduled_count > 0 && (
                    <span className="text-[10px] text-brand-text-secondary shrink-0">
                      📅 {u.scheduled_count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-xs text-brand-text-secondary mt-2 italic">
              … и ещё {rest}. Полный список — на странице /content-bank.
            </p>
          )}
        </>
      )}
    </div>
  )
}
