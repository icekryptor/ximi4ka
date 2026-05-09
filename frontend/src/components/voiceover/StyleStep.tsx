import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { voiceoverApi } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

export function StyleStep({ state, update, onBack, onNext }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [styling, setStyling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const runStyle = async () => {
    setStyling(true)
    try {
      const r = await voiceoverApi.style(state.draft)
      update({ finalScript: r.text })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка стиль-фильтра')
    } finally {
      setStyling(false)
    }
  }

  const applyEdits = async () => {
    if (!state.editNotes.trim()) return
    setEditing(true)
    try {
      const r = await voiceoverApi.edit(state.finalScript, state.editNotes)
      update({ finalScript: r.text, editNotes: '' })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка применения правок')
    } finally {
      setEditing(false)
    }
  }

  const saveAndNext = async () => {
    if (!state.unit) return onNext()
    const existing = state.unit.script_text ?? ''
    if (existing && existing.trim() !== state.finalScript.trim()) {
      const ok = await confirm({
        title: 'Перезаписать сценарий?',
        message: 'В юните уже сохранён сценарий. Перезаписать его новым из студии?',
        variant: 'danger',
        confirmText: 'Перезаписать',
      })
      if (!ok) return
    }
    setSaving(true)
    try {
      await unitsApi.update(state.unit.id, { script_text: state.finalScript })
      onNext()
    } catch {
      toast.error('Не удалось сохранить сценарий')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Стиль-фильтр</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Прогон через style_guide_video — 14 базовых правил + аудиальные/стилистические уточнения.
        </p>
      </div>

      {!state.finalScript && (
        <button onClick={runStyle} disabled={styling} className="btn btn-primary">
          {styling ? <Loader2 size={14} className="animate-spin" /> : '✨'} Применить стиль
        </button>
      )}

      {state.finalScript && (
        <>
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Финальный сценарий</label>
            <textarea
              value={state.finalScript}
              onChange={(e) => update({ finalScript: e.target.value })}
              rows={16}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
            />
          </div>

          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Правки</label>
            <textarea
              value={state.editNotes}
              onChange={(e) => update({ editNotes: e.target.value })}
              rows={3}
              placeholder="Например: убрать пафос в финале, добавить шутку в середине…"
              className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={applyEdits}
                disabled={editing || !state.editNotes.trim()}
                className="btn btn-secondary text-sm"
              >
                {editing ? <Loader2 size={14} className="animate-spin" /> : '✏️'} Применить правки
              </button>
              <button onClick={runStyle} disabled={styling} className="btn btn-secondary text-sm">
                {styling ? <Loader2 size={14} className="animate-spin" /> : '🔄'} Прогнать стиль ещё раз
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-border">
        <button onClick={onBack} className="btn btn-secondary">← К фактчеку</button>
        <button
          onClick={saveAndNext}
          disabled={saving || !state.finalScript.trim()}
          className="btn btn-primary"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '💾'} Сохранить и продолжить →
        </button>
      </div>
    </div>
  )
}
