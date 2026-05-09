import { StepKey } from '../../pages/VoiceoverStudio'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'pick', label: 'Идея' },
  { key: 'generate', label: 'Сценарий' },
  { key: 'factcheck', label: 'Факты' },
  { key: 'style', label: 'Стиль' },
  { key: 'preprocess', label: 'ТЗ' },
]

interface Props {
  currentStep: StepKey
  onJump: (s: StepKey) => void
}

export function StepNav({ currentStep, onJump }: Props) {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep)
  return (
    <div className="flex items-center justify-between gap-1 sm:gap-2 border-b border-brand-border pb-4">
      {STEPS.map((s, i) => {
        const passed = currentIdx > i
        const current = currentIdx === i
        const clickable = passed
        return (
          <div key={s.key} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(s.key)}
              className={
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ' +
                (passed
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : current
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                  : 'bg-subtle text-brand-text-secondary')
              }
              aria-label={`Шаг ${i + 1}: ${s.label}`}
            >
              {passed ? '✓' : i + 1}
            </button>
            <span
              className={
                'text-sm whitespace-nowrap ' +
                (current ? 'font-semibold text-brand-text' : 'text-brand-text-secondary')
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={'w-4 sm:w-8 h-0.5 ' + (passed ? 'bg-primary-500' : 'bg-subtle')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
