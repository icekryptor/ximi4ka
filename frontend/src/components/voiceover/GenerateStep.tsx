import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

const STYLE_OPTIONS = [
  'образовательный',
  'провокационный',
  'историчный',
  'мрачный',
  'весёлый',
  'детективный',
]

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

export function GenerateStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const toggleStyle = (s: string) => {
    update({
      styles: state.styles.includes(s) ? state.styles.filter(x => x !== s) : [...state.styles, s],
    })
  }

  const generate = async () => {
    if (!state.topic.trim()) {
      toast.error('Опиши тему сценария')
      return
    }
    setRunning(true)
    try {
      const r = await voiceoverApi.generate({
        topic: state.topic,
        duration: state.duration,
        styles: state.styles,
      })
      update({ draft: r.text, finalScript: r.text })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка генерации')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Сценарий</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Опиши тему и стилистические предпочтения. Claude сгенерирует сценарий по гайду.
        </p>
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Тема</label>
        <textarea
          value={state.topic}
          onChange={(e) => update({ topic: e.target.value })}
          rows={6}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm whitespace-pre-line"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Длина (сек)</label>
          <select
            value={state.duration}
            onChange={(e) => update({ duration: e.target.value as WizardState['duration'] })}
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
          >
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="120">120</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Стиль</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STYLE_OPTIONS.map((s) => {
              const sel = state.styles.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStyle(s)}
                  className={
                    'px-2.5 py-1 text-xs rounded-full border transition-colors ' +
                    (sel
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300')
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {state.draft && (
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Черновик</label>
          <textarea
            value={state.draft}
            onChange={(e) => update({ draft: e.target.value, finalScript: e.target.value })}
            rows={14}
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
          />
          <p className="text-xs text-brand-text-secondary mt-1">
            Можно править вручную — изменения попадут в фактчек и стиль-фильтр.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К идеям</button>
        <div className="flex gap-2">
          <button onClick={generate} disabled={running} className="btn btn-secondary">
            {running ? <Loader2 size={14} className="animate-spin" /> : '🪄'}
            {state.draft ? 'Перегенерировать' : 'Сгенерировать'}
          </button>
          <button onClick={onNext} disabled={!state.draft.trim()} className="btn btn-primary">
            Дальше — фактчек →
          </button>
        </div>
      </div>
    </div>
  )
}
