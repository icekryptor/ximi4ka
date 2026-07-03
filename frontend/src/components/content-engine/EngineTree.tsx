import { useState } from 'react'
import { Bot, ChevronDown, ChevronRight, FileText, User } from 'lucide-react'
import { BlueprintContentType, BlueprintDoc, BlueprintStep } from '../../api/contentEngine'

/**
 * Схема контент-движка слева-направо: типы → конвейер шагов → чипы-инструкции.
 * Без graph-библиотек — flex + CSS-линии (паттерн AssemblyTree).
 *
 * Ур.1 — карточка типа, клик разворачивает конвейер.
 * Ур.2 — шаги вправо `[Драфт] → [Финал]`; AI-шаг фиолетовый + 🤖, self серый + 👤,
 *        AI без билдера — жёлтый.
 * Ур.3 — под AI-шагом чипы reads вниз, линии шаг→чип.
 */

export type EngineSelection =
  | { kind: 'step'; contentType: string; step: BlueprintStep }
  | { kind: 'doc'; slug: string }

interface EngineTreeProps {
  contentTypes: BlueprintContentType[]
  docs: Record<string, BlueprintDoc>
  selected: EngineSelection | null
  onSelect: (sel: EngineSelection) => void
}

const isAiStep = (s: BlueprintStep) => s.executor === 'ai_agent'
const isBroken = (s: BlueprintStep) => isAiStep(s) && !s.hasBuilder

// ─── Чип шага ────────────────────────────────────────────────────────────────

interface StepChipProps {
  step: BlueprintStep
  selected: boolean
  onSelect: () => void
}

const StepChip = ({ step, selected, onSelect }: StepChipProps) => {
  const ai = isAiStep(step)
  const broken = isBroken(step)

  const tone = broken
    ? {
        border: selected ? 'border-amber-500 ring-2 ring-amber-400/40' : 'border-amber-400 hover:border-amber-500',
        icon: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-700',
      }
    : ai
      ? {
          border: selected ? 'border-primary-500 ring-2 ring-primary-400/40' : 'border-primary-300 hover:border-primary-400',
          icon: 'text-primary-600',
          badge: 'bg-primary-100 text-primary-700',
        }
      : {
          border: selected ? 'border-brand-text/40 ring-2 ring-brand-text/10' : 'border-brand-border hover:border-brand-text/30',
          icon: 'text-brand-text-secondary',
          badge: 'bg-muted text-brand-text-secondary',
        }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-52 shrink-0 cursor-pointer rounded-xl border bg-card px-3 py-2 text-left shadow-soft transition-all ${tone.border}`}
    >
      <div className="flex items-center gap-2">
        {ai ? <Bot className={`h-4 w-4 shrink-0 ${tone.icon}`} /> : <User className={`h-4 w-4 shrink-0 ${tone.icon}`} />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-text" title={step.displayName}>
          {step.displayName}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tone.badge}`}>
          {ai ? 'AI-агент' : 'вручную'}
        </span>
        {step.artifactKind && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-brand-text-secondary" title="Артефакт">
            {step.artifactKind}
          </span>
        )}
        {broken && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            промпт не реализован
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Чип инструкции (brand_doc) ──────────────────────────────────────────────

interface DocChipProps {
  slug: string
  doc: BlueprintDoc | undefined
  selected: boolean
  onSelect: () => void
}

const DocChip = ({ slug, doc, selected, onSelect }: DocChipProps) => {
  const empty = !doc || !doc.content
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-52 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-left transition-all ${
        selected
          ? 'border-primary-500 ring-2 ring-primary-400/40'
          : 'border-brand-border hover:border-primary-300 hover:shadow-sm'
      }`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-primary-600" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-brand-text" title={doc?.title ?? slug}>
          {doc?.title ?? slug}
        </div>
        <div className="truncate font-mono text-[10px] text-brand-text-secondary/70">{slug}</div>
      </div>
      {empty && <span className="shrink-0 text-[10px] text-brand-text-secondary/70">(пусто)</span>}
    </button>
  )
}

// ─── Конвейер одного типа контента ────────────────────────────────────────────

interface PipelineProps {
  contentType: BlueprintContentType
  docs: Record<string, BlueprintDoc>
  selected: EngineSelection | null
  onSelect: (sel: EngineSelection) => void
}

const Pipeline = ({ contentType, docs, selected, onSelect }: PipelineProps) => {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-0 pt-2">
        {contentType.steps.map((step, i) => {
          const stepSelected =
            selected?.kind === 'step' && selected.contentType === contentType.type && selected.step.id === step.id
          const last = i === contentType.steps.length - 1
          return (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center">
                <StepChip
                  step={step}
                  selected={stepSelected}
                  onSelect={() => onSelect({ kind: 'step', contentType: contentType.type, step })}
                />
                {step.reads.length > 0 && (
                  <div className="flex flex-col items-center">
                    {/* вертикальная линия шаг→ветка чипов */}
                    <div className="h-4 w-0.5 bg-brand-border" />
                    <div className="flex flex-col gap-2">
                      {step.reads.map((slug) => {
                        const docSelected = selected?.kind === 'doc' && selected.slug === slug
                        return (
                          <div key={slug} className="flex items-center">
                            {/* горизонтальный стык к чипу */}
                            <div className="h-0.5 w-3 bg-brand-border" />
                            <DocChip
                              slug={slug}
                              doc={docs[slug]}
                              selected={docSelected}
                              onSelect={() => onSelect({ kind: 'doc', slug })}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* стрелка между шагами */}
              {!last && (
                <div className="flex w-8 shrink-0 items-center self-start pt-6 text-brand-text-secondary">
                  <div className="h-0.5 flex-1 bg-brand-border" />
                  <ChevronRight className="-ml-1 h-4 w-4" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Дерево целиком ────────────────────────────────────────────────────────────

export const EngineTree = ({ contentTypes, docs, selected, onSelect }: EngineTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(contentTypes.map((c) => c.type)))

  const toggle = (type: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (contentTypes.length === 0) {
    return (
      <section className="card text-center py-12">
        <p className="text-brand-text-secondary">Рецептов пока нет — движок не сконфигурирован.</p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {contentTypes.map((ct) => {
        const open = expanded.has(ct.type)
        return (
          <section key={ct.type} className="card">
            <button
              type="button"
              onClick={() => toggle(ct.type)}
              className="flex w-full items-start gap-2 text-left"
            >
              {open ? (
                <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-secondary" />
              ) : (
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-brand-text-secondary" />
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-brand-text">
                  {ct.displayName}
                  <span className="ml-2 font-mono text-xs font-normal text-brand-text-secondary/70">{ct.type}</span>
                </h2>
                {ct.description && (
                  <p className="mt-0.5 text-sm text-brand-text-secondary">{ct.description}</p>
                )}
              </div>
            </button>

            {open && (
              <div className="mt-4">
                <Pipeline contentType={ct} docs={docs} selected={selected} onSelect={onSelect} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
