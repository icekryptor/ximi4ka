import { Fragment, ReactNode } from 'react'
import { Bot, FileText, User } from 'lucide-react'
import { BlueprintDoc, BlueprintStep } from '../../api/contentEngine'
import { EngineSelection } from './EngineTree'

/**
 * Правая панель деталей:
 *  - kind==='step': заголовок, executor-бейдж, artifact_kind, описание,
 *    system-промпт (моно, подсветка плейсхолдеров ‹…›) + список читаемых доков.
 *  - kind==='doc': title + полный content brand_doc (или «документ пуст»).
 */

interface StepDetailPanelProps {
  selection: EngineSelection | null
  docs: Record<string, BlueprintDoc>
  onSelect: (sel: EngineSelection) => void
}

// Подсветка плейсхолдеров вида ‹…› внутри промпт-превью.
const highlightPlaceholders = (text: string): ReactNode[] => {
  const parts = text.split(/(‹[^›]+›)/g)
  return parts.map((part, i) => {
    if (/^‹[^›]+›$/.test(part)) {
      return (
        <span key={i} className="rounded bg-primary-100 px-1 font-semibold text-primary-700">
          {part}
        </span>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

export const StepDetailPanel = ({ selection, docs, onSelect }: StepDetailPanelProps) => {
  if (!selection) {
    return (
      <div className="card">
        <p className="py-8 text-center text-sm text-brand-text-secondary">
          Выберите шаг или инструкцию слева, чтобы увидеть детали.
        </p>
      </div>
    )
  }

  if (selection.kind === 'doc') {
    const doc = docs[selection.slug]
    return (
      <div className="card">
        <div className="mb-3 flex items-start gap-2">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-text">{doc?.title ?? selection.slug}</h2>
            <p className="font-mono text-xs text-brand-text-secondary/70">{selection.slug}</p>
          </div>
        </div>
        {doc?.content ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-border bg-muted/40 p-4 font-mono text-sm text-brand-text">
            {doc.content}
          </pre>
        ) : (
          <p className="py-8 text-center text-sm text-brand-text-secondary">Документ пуст.</p>
        )}
      </div>
    )
  }

  const step = selection.step
  const ai = step.executor === 'ai_agent'

  return (
    <div className="card">
      <div className="mb-3 flex items-start gap-2">
        {ai ? (
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
        ) : (
          <User className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-secondary" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-brand-text">{step.displayName}</h2>
          <p className="font-mono text-xs text-brand-text-secondary/70">{step.id}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ai ? 'bg-primary-100 text-primary-700' : 'bg-muted text-brand-text-secondary'
          }`}
        >
          {ai ? 'AI-агент' : 'вручную'}
        </span>
        {step.artifactKind && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-brand-text-secondary">
            артефакт: {step.artifactKind}
          </span>
        )}
        {step.aiAssistKey && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-brand-text-secondary">
            {step.aiAssistKey}
          </span>
        )}
      </div>

      {step.description && <p className="mb-4 text-sm text-brand-text-secondary">{step.description}</p>}

      {ai && !step.hasBuilder && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Для этого шага задан <code className="font-mono">ai_assist_key</code>, но промпт-билдер ещё не реализован.
        </div>
      )}

      {step.promptPreview && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-brand-text">System-промпт агента</h3>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-border bg-muted/40 p-4 font-mono text-sm text-brand-text">
            {highlightPlaceholders(step.promptPreview)}
          </pre>
          <p className="mt-1 text-xs text-brand-text-secondary/70">
            <span className="rounded bg-primary-100 px-1 font-semibold text-primary-700">‹…›</span> — плейсхолдеры,
            подставляются на прогоне.
          </p>
        </div>
      )}

      {step.reads.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-text">Читаемые инструкции</h3>
          <div className="flex flex-col gap-2">
            {step.reads.map((slug) => {
              const doc = docs[slug]
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onSelect({ kind: 'doc', slug })}
                  className="flex items-center gap-2 rounded-lg border border-brand-border bg-card px-2.5 py-1.5 text-left transition-all hover:border-primary-300 hover:shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-brand-text">{doc?.title ?? slug}</div>
                    <div className="truncate font-mono text-[10px] text-brand-text-secondary/70">{slug}</div>
                  </div>
                  {(!doc || !doc.content) && (
                    <span className="shrink-0 text-[10px] text-brand-text-secondary/70">(пусто)</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
