import { useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { useToast } from '../../contexts/ToastContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

const TYPE_META = {
  ok:   { color: 'text-green-700  bg-green-50  border-green-200',  Icon: CheckCircle2 },
  warn: { color: 'text-amber-700  bg-amber-50  border-amber-200',  Icon: AlertTriangle },
  err:  { color: 'text-red-700    bg-red-50    border-red-200',    Icon: XCircle },
  info: { color: 'text-blue-700   bg-blue-50   border-blue-200',   Icon: Info },
} as const

export function FactcheckStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      const r = await voiceoverApi.factcheck(state.draft)
      update({ factcheck: r.items })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка фактчекинга')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Фактчек</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Проверка цитат, дат, химических свойств, имён организаций.
        </p>
      </div>

      <div className="bg-subtle rounded-xl p-4 max-h-64 overflow-y-auto">
        <div className="text-xs uppercase text-brand-text-secondary tracking-wider mb-2">Сценарий</div>
        <pre className="text-sm whitespace-pre-line font-mono text-brand-text">{state.draft}</pre>
      </div>

      {state.factcheck.length === 0 && !running && (
        <button onClick={run} className="btn btn-primary">
          🔍 Запустить фактчек
        </button>
      )}

      {running && (
        <div className="flex items-center gap-2 text-brand-text-secondary">
          <Loader2 size={16} className="animate-spin" /> Проверяем факты…
        </div>
      )}

      {state.factcheck.length > 0 && (
        <div className="space-y-2">
          {state.factcheck.map((item, i) => {
            const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.info
            const Icon = meta.Icon
            return (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-xl border ${meta.color}`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="text-sm whitespace-pre-line">{item.text}</div>
              </div>
            )
          })}
          <button onClick={run} disabled={running} className="btn btn-secondary text-sm">
            🔄 Перезапустить фактчек
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К сценарию</button>
        <button onClick={onNext} className="btn btn-primary">Дальше — стиль →</button>
      </div>
    </div>
  )
}
