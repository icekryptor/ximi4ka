import { Fragment, ReactNode, useState } from 'react'
import { Bot, Check, Compass, Copy, FileText, User } from 'lucide-react'
import { BlueprintDoc, BlueprintStep } from '../../api/contentEngine'
import { EngineSelection } from './EngineTree'

// Кнопка «Копировать» с fallback на execCommand и состоянием «Скопировано».
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер недоступен — тихо игнорируем */
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-card px-2 py-1 text-xs text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Скопировано' : 'Копировать'}
    </button>
  )
}

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
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-brand-text">{doc?.title ?? selection.slug}</h2>
            <p className="font-mono text-xs text-brand-text-secondary/70">{selection.slug}</p>
          </div>
          {doc?.content && <CopyButton text={doc.content} />}
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

  if (selection.kind === 'planner') {
    const planner = selection.planner
    return (
      <div className="card">
        <div className="mb-3 flex items-start gap-2">
          <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-brand-text">🧭 Planner — контент-стратег</h2>
            <p className="mt-0.5 text-sm text-brand-text-secondary">
              Скопируй промпт и вставь в Claude Desktop Cowork (проект Химички). Получишь контент-план — сохрани его в{' '}
              <span className="font-mono">{planner.produces.slug}</span>.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            upstream-агент
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-brand-text-secondary">
            создаёт: {planner.produces.title}
          </span>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-text">Промпт для Cowork</h3>
            <CopyButton text={planner.promptPreview} />
          </div>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-brand-border bg-muted/40 p-4 font-mono text-sm text-brand-text">
            {planner.promptPreview}
          </pre>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-text">Читаемые источники</h3>
          <div className="flex flex-col gap-2">
            {planner.reads.map((r) => {
              const doc = docs[r.slug]
              const openable = !!doc
              const inner = (
                <>
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-brand-text">{r.title}</div>
                    <div className="truncate font-mono text-[10px] text-brand-text-secondary/70">{r.slug}</div>
                  </div>
                  {(!doc || !doc.content) && (
                    <span className="shrink-0 text-[10px] text-brand-text-secondary/70">
                      {openable ? '(пусто)' : '(динамически)'}
                    </span>
                  )}
                </>
              )
              return openable ? (
                <button
                  key={r.slug}
                  type="button"
                  onClick={() => onSelect({ kind: 'doc', slug: r.slug })}
                  className="flex items-center gap-2 rounded-lg border border-brand-border bg-card px-2.5 py-1.5 text-left transition-all hover:border-primary-300 hover:shadow-sm"
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={r.slug}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-brand-border bg-card px-2.5 py-1.5"
                >
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-text">System-промпт агента</h3>
            <CopyButton text={step.promptPreview} />
          </div>
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
              // style_learned — динамический свод правил стиля, не статичный
              // brand_doc: помечаем «динамически, см. Обучение стиля».
              const dynamic = slug === 'style_learned'
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onSelect({ kind: 'doc', slug })}
                  className={`flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left transition-all hover:border-primary-300 hover:shadow-sm ${
                    dynamic ? 'border-dashed border-primary-300' : 'border-brand-border'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-brand-text">{doc?.title ?? slug}</div>
                    <div className="truncate font-mono text-[10px] text-brand-text-secondary/70">{slug}</div>
                  </div>
                  {dynamic ? (
                    <span className="shrink-0 text-[10px] text-primary-700">
                      динамически, см. Обучение стиля
                    </span>
                  ) : (
                    (!doc || !doc.content) && (
                      <span className="shrink-0 text-[10px] text-brand-text-secondary/70">(пусто)</span>
                    )
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
