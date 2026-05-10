import { useState } from 'react'
import { Loader2, Plus, Check, X, RefreshCw, Save, RotateCcw } from 'lucide-react'
import { voiceoverApi, Pattern } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
  onRegenerate: () => void
}

export function StyleStep({ state, update, onBack, onNext, onRegenerate }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [notes, setNotes] = useState('')
  const [running, setRunning] = useState(false)
  const [applyingGuide, setApplyingGuide] = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)

  // Has the operator applied patterns in this iteration? Reset on every new edit pass.
  const [guideApplied, setGuideApplied] = useState(false)

  const hasPatterns = state.patterns.length > 0
  const approvedCount = state.patternsApproved.filter(Boolean).length

  const applyEditAndExtract = async () => {
    if (!notes.trim() && state.finalScript === state.draft) {
      toast.error('Внеси правки в текст или опиши их в заметках')
      return
    }
    setRunning(true)
    setGuideApplied(false)
    try {
      const r = await voiceoverApi.editWithLearning({
        originalScript: state.draft,
        notes: notes.trim() || undefined,
        editedScript:
          state.finalScript !== state.draft ? state.finalScript : undefined,
      })
      update({
        finalScript: r.finalScript,
        editSummary: r.summary,
        patterns: r.patterns,
        patternsApproved: r.patterns.map(() => true),
      })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка обучения на правках')
    } finally {
      setRunning(false)
    }
  }

  const togglePattern = (idx: number) => {
    const next = [...state.patternsApproved]
    next[idx] = !next[idx]
    update({ patternsApproved: next })
  }

  const editPattern = (idx: number, key: keyof Pattern, value: string) => {
    const next = [...state.patterns]
    next[idx] = { ...next[idx], [key]: value }
    update({ patterns: next })
  }

  const applyGuideAddenda = async () => {
    const approved = state.patterns.filter((_, i) => state.patternsApproved[i])
    if (approved.length === 0) {
      setGuideApplied(true)
      return
    }
    setApplyingGuide(true)
    try {
      const r = await voiceoverApi.extendGuide(approved)
      toast.success(`Гайд обновлён до версии ${r.version}`)
      setGuideApplied(true)
    } catch {
      toast.error('Не удалось обновить гайд')
    } finally {
      setApplyingGuide(false)
    }
  }

  const startAnotherIteration = () => {
    update({
      iteration: state.iteration + 1,
      patterns: [],
      patternsApproved: [],
      editSummary: '',
      draft: state.finalScript,
    })
    setNotes('')
    setGuideApplied(false)
  }

  const regenerateWithUpdatedGuide = async () => {
    const ok = await confirm({
      title: 'Перегенерировать?',
      message:
        'Сценарий будет сгенерирован заново с обновлённым гайдом. Текущая версия пропадёт.',
      variant: 'danger',
      confirmText: 'Перегенерировать',
    })
    if (!ok) return
    update({
      iteration: 1,
      patterns: [],
      patternsApproved: [],
      editSummary: '',
      draft: '',
      finalScript: '',
    })
    onRegenerate()
  }

  const saveAndContinue = async () => {
    if (!state.unit) return onNext()
    const existing = state.unit.script_text ?? ''
    if (existing && existing.trim() !== state.finalScript.trim()) {
      const ok = await confirm({
        title: 'Перезаписать сценарий?',
        message: 'В юните уже сохранён сценарий. Перезаписать новым из студии?',
        variant: 'danger',
        confirmText: 'Перезаписать',
      })
      if (!ok) return
    }
    setSavingFinal(true)
    try {
      await unitsApi.update(state.unit.id, { script_text: state.finalScript })
      onNext()
    } catch {
      toast.error('Не удалось сохранить сценарий')
    } finally {
      setSavingFinal(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-text">Редактирование</h2>
          <p className="text-sm text-brand-text-secondary mt-1">
            Внеси правки или опиши их в заметках. Claude извлечёт паттерны и предложит дополнения к гайду.
          </p>
        </div>
        <span className="text-xs font-mono text-brand-text-secondary bg-subtle px-2 py-1 rounded">
          Итерация {state.iteration}
        </span>
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
          Сценарий (можно редактировать прямо здесь)
        </label>
        <textarea
          value={state.finalScript}
          onChange={(e) => update({ finalScript: e.target.value })}
          rows={16}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
        />
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
          Заметки (опционально — если объяснить правки проще словами)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Например: убрать пафос в финале, заменить «огромный» на конкретное число, перенести шутку выше"
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
        />
      </div>

      <button
        onClick={applyEditAndExtract}
        disabled={running}
        className="btn btn-primary"
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{' '}
        Применить правки и извлечь паттерны
      </button>

      {hasPatterns && (
        <div className="space-y-3 border-t border-brand-border pt-4">
          {state.editSummary && (
            <div className="text-sm text-brand-text-secondary italic">
              {state.editSummary}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-brand-text mb-2">
              Предложенные дополнения к гайду ({approvedCount}/{state.patterns.length})
            </h3>
            <ul className="space-y-2">
              {state.patterns.map((p, i) => {
                const approved = state.patternsApproved[i]
                return (
                  <li
                    key={i}
                    className={`rounded-xl border p-3 transition-colors ${
                      approved
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-subtle border-brand-border opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => togglePattern(i)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          approved
                            ? 'bg-primary-500 text-white'
                            : 'bg-card border border-brand-border text-brand-text-secondary'
                        }`}
                      >
                        {approved ? <Check size={12} /> : <X size={12} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={p.code}
                            onChange={(e) => editPattern(i, 'code', e.target.value)}
                            className="font-mono text-xs px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent w-12"
                          />
                          <input
                            type="text"
                            value={p.title}
                            onChange={(e) => editPattern(i, 'title', e.target.value)}
                            className="flex-1 text-sm font-semibold px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                          />
                        </div>
                        {p.before !== undefined && (
                          <div className="text-xs text-red-700 mb-0.5">
                            ❌{' '}
                            <input
                              type="text"
                              value={p.before}
                              onChange={(e) => editPattern(i, 'before', e.target.value)}
                              className="w-[calc(100%-1.5rem)] px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                            />
                          </div>
                        )}
                        {p.after !== undefined && (
                          <div className="text-xs text-green-700 mb-1">
                            ✅{' '}
                            <input
                              type="text"
                              value={p.after}
                              onChange={(e) => editPattern(i, 'after', e.target.value)}
                              className="w-[calc(100%-1.5rem)] px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                            />
                          </div>
                        )}
                        <textarea
                          value={p.rationale}
                          onChange={(e) => editPattern(i, 'rationale', e.target.value)}
                          rows={2}
                          className="w-full text-xs text-brand-text-secondary px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent resize-y"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {!guideApplied && (
            <button
              onClick={applyGuideAddenda}
              disabled={applyingGuide}
              className="btn btn-primary text-sm"
            >
              {applyingGuide ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{' '}
              Применить {approvedCount} дополнений к гайду
            </button>
          )}

          {guideApplied && (
            <div className="space-y-2 pt-3 border-t border-brand-border">
              <p className="text-sm text-green-700 font-medium">
                ✓ Гайд обновлён. Что делаем дальше?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={startAnotherIteration}
                  className="btn btn-secondary text-sm"
                >
                  <RotateCcw size={14} /> Ещё правка
                </button>
                <button
                  onClick={regenerateWithUpdatedGuide}
                  className="btn btn-secondary text-sm"
                >
                  <RefreshCw size={14} /> Перегенерировать
                </button>
                <button
                  onClick={saveAndContinue}
                  disabled={savingFinal}
                  className="btn btn-primary text-sm"
                >
                  {savingFinal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
                  Сохранить как финал →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasPatterns && (
        <div className="flex items-center justify-between pt-4 border-t border-brand-border">
          <button onClick={onBack} className="btn btn-secondary">← К фактчеку</button>
          <button
            onClick={saveAndContinue}
            disabled={savingFinal || !state.finalScript.trim()}
            className="btn btn-primary"
          >
            {savingFinal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
            Сохранить и продолжить →
          </button>
        </div>
      )}
    </div>
  )
}
