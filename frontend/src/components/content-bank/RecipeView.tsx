import { useState } from 'react'
import { Sparkles, Check, RotateCw, Save, FileText, Bot, User } from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { recipesApi } from '../../api/recipes'
import type { Recipe, RecipeState, RecipeStepState, RecipeStep } from '../../api/types'
import type { ContentUnit } from '../../api/contentBank'

interface Props {
  unit: ContentUnit
  recipe: Recipe
  onChange: (updated: ContentUnit) => void
}

const STATUS_LABELS: Record<RecipeStepState['status'], string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  awaiting_review: 'На проверке',
  completed: 'Готово',
  skipped: 'Пропущено',
}

const STATUS_COLORS: Record<RecipeStepState['status'], string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_review: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-500',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

export function RecipeView({ unit, recipe, onChange }: Props) {
  const toast = useToast()
  const [initLoading, setInitLoading] = useState(false)
  const [runningStepId, setRunningStepId] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})

  const state = unit.recipe_state as RecipeState | null

  async function handleInit() {
    setInitLoading(true)
    try {
      const updated = await recipesApi.initForUnit(unit.id)
      onChange(updated)
      toast.success('Рецепт инициализирован')
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка инициализации'))
    } finally {
      setInitLoading(false)
    }
  }

  function updateStepLocal(stepId: string, patch: Partial<RecipeStepState>): RecipeState | null {
    if (!state) return null
    return {
      ...state,
      steps: state.steps.map((s) => (s.step_id === stepId ? { ...s, ...patch } : s)),
    }
  }

  async function persistState(newState: RecipeState) {
    const updated = await recipesApi.patchState(unit.id, newState)
    onChange(updated)
  }

  async function handleRunAi(step: RecipeStep) {
    setRunningStepId(step.id)
    try {
      const { text } = await recipesApi.runStep(unit.id, step.id, customPrompts[step.id])
      const cur = state?.steps.find((s) => s.step_id === step.id)
      const newState = updateStepLocal(step.id, {
        status: 'awaiting_review',
        artifact_text: text,
        ai_run_count: (cur?.ai_run_count ?? 0) + 1,
      })
      if (newState) await persistState(newState)
      toast.success('Шаг выполнен')
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка генерации'))
    } finally {
      setRunningStepId(null)
    }
  }

  async function handleAcceptStep(stepId: string, finalText: string) {
    const newState = updateStepLocal(stepId, {
      status: 'completed',
      artifact_text: finalText,
      completed_at: new Date().toISOString(),
    })
    if (newState) {
      try {
        await persistState(newState)
        toast.success('Шаг принят')
      } catch (e) {
        toast.error(errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  async function handleSaveDraft(stepId: string, draftText: string) {
    const newState = updateStepLocal(stepId, { artifact_text: draftText })
    if (newState) {
      try {
        await persistState(newState)
        toast.success('Черновик сохранён')
      } catch (e) {
        toast.error(errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  async function handleReopenStep(stepId: string) {
    const newState = updateStepLocal(stepId, { status: 'in_progress', completed_at: null })
    if (newState) {
      try {
        await persistState(newState)
      } catch (e) {
        toast.error(errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  async function handleStartManualStep(stepId: string, currentText: string) {
    const newState = updateStepLocal(stepId, {
      status: 'in_progress',
      artifact_text: currentText,
    })
    if (newState) {
      try {
        await persistState(newState)
      } catch (e) {
        toast.error(errorMessage(e, 'Ошибка сохранения'))
      }
    }
  }

  if (!state) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-start gap-3 mb-3">
          <FileText className="w-5 h-5 mt-0.5 text-brand-text-secondary" />
          <div>
            <h3 className="font-semibold text-brand-text">{recipe.display_name}</h3>
            <p className="text-sm text-brand-text-secondary">{recipe.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleInit}
          disabled={initLoading}
          className="btn btn-primary text-sm"
        >
          {initLoading ? 'Инициализация...' : 'Инициализировать рецепт'}
        </button>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 mt-0.5 text-brand-text-secondary" />
        <div>
          <h3 className="font-semibold text-brand-text">{recipe.display_name}</h3>
          <p className="text-sm text-brand-text-secondary">{recipe.description}</p>
        </div>
      </div>

      {recipe.steps.map((step, idx) => {
        const stepState = state.steps.find((s) => s.step_id === step.id)
        if (!stepState) return null
        const ExecutorIcon = stepState.executor_type === 'ai_agent' ? Bot : User
        const isRunning = runningStepId === step.id
        const isAiStep = step.default_executor === 'ai_agent' && !!step.ai_assist_key
        const canRunAi = isAiStep && (stepState.status === 'pending' || stepState.status === 'in_progress')

        return (
          <div key={step.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-brand-text-secondary">{idx + 1}.</span>
                  <h4 className="font-semibold text-brand-text">{step.display_name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[stepState.status]}`}>
                    {STATUS_LABELS[stepState.status]}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 inline-flex items-center gap-1">
                    <ExecutorIcon className="w-3 h-3" />
                    {stepState.executor_type === 'ai_agent'
                      ? 'AI'
                      : stepState.executor_type === 'self'
                        ? 'Оператор'
                        : 'Подрядчик'}
                  </span>
                </div>
                <p className="text-xs text-brand-text-secondary">{step.description}</p>
              </div>
            </div>

            {/* AI step — pending / in_progress: show generate button + optional custom prompt */}
            {canRunAi && stepState.status !== 'awaiting_review' && (
              <div className="space-y-2">
                <textarea
                  className="w-full p-2 text-sm border rounded resize-none"
                  rows={2}
                  placeholder="Дополнительные инструкции для AI (опционально)"
                  aria-label="Дополнительные инструкции для AI"
                  value={customPrompts[step.id] ?? ''}
                  onChange={(e) => setCustomPrompts({ ...customPrompts, [step.id]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => handleRunAi(step)}
                  disabled={isRunning}
                  className="btn btn-primary text-sm inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isRunning ? 'Генерация...' : stepState.ai_run_count > 0 ? 'Перегенерировать' : 'Сгенерировать'}
                </button>
                {stepState.ai_run_count > 0 && (
                  <span className="text-xs text-brand-text-secondary ml-2">
                    Запусков: {stepState.ai_run_count}
                  </span>
                )}
              </div>
            )}

            {/* awaiting_review (AI returned) or in_progress (manual edit) — editable textarea */}
            {(stepState.status === 'awaiting_review' || (stepState.status === 'in_progress' && !isAiStep)) && (
              <StepEditor
                initialText={stepState.artifact_text ?? ''}
                onAccept={(text) => handleAcceptStep(step.id, text)}
                onSaveDraft={(text) => handleSaveDraft(step.id, text)}
                onRegenerate={isAiStep ? () => handleRunAi(step) : undefined}
              />
            )}

            {/* completed — show readonly + reopen */}
            {stepState.status === 'completed' && (
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 border rounded text-sm whitespace-pre-wrap text-brand-text">
                  {stepState.artifact_text}
                </div>
                <button
                  type="button"
                  onClick={() => handleReopenStep(step.id)}
                  className="btn btn-secondary text-xs"
                >
                  Открыть для правки
                </button>
              </div>
            )}

            {/* Manual step that's still pending — let operator start it */}
            {!isAiStep && stepState.status === 'pending' && (
              <button
                type="button"
                onClick={() => handleStartManualStep(step.id, stepState.artifact_text ?? '')}
                className="btn btn-secondary text-sm"
              >
                Начать шаг
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface StepEditorProps {
  initialText: string
  onAccept: (text: string) => void | Promise<void>
  onSaveDraft: (text: string) => void | Promise<void>
  onRegenerate?: () => void | Promise<void>
}

function StepEditor({ initialText, onAccept, onSaveDraft, onRegenerate }: StepEditorProps) {
  const [text, setText] = useState(initialText)
  return (
    <div className="space-y-2">
      <textarea
        className="w-full p-3 text-sm border rounded resize-y"
        rows={8}
        aria-label="Текст артефакта шага"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onAccept(text)}
          className="btn btn-primary text-sm inline-flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Принять
        </button>
        <button
          type="button"
          onClick={() => onSaveDraft(text)}
          className="btn btn-secondary text-sm inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Сохранить черновик
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="btn btn-secondary text-sm inline-flex items-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Перегенерировать
          </button>
        )}
      </div>
    </div>
  )
}
