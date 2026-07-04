import { useState } from 'react'
import { ArrowRight, Bot, ChevronDown, ChevronRight, Compass, FileText, User } from 'lucide-react'
import { BlueprintContentType, BlueprintDoc, BlueprintPlanner, BlueprintStep } from '../../api/contentEngine'

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
  | { kind: 'planner'; planner: BlueprintPlanner }

interface EngineTreeProps {
  planner: BlueprintPlanner | null
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

// ─── Planner — upstream-узел слева от типов ──────────────────────────────────

interface PlannerNodeProps {
  planner: BlueprintPlanner
  docs: Record<string, BlueprintDoc>
  selected: EngineSelection | null
  onSelect: (sel: EngineSelection) => void
}

const PlannerNode = ({ planner, docs, selected, onSelect }: PlannerNodeProps) => {
  const nodeSelected = selected?.kind === 'planner'
  const produces = planner.produces
  const producesSelected = selected?.kind === 'doc' && selected.slug === produces.slug

  return (
    <section className="card">
      <div className="mb-3 flex items-start gap-2">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-brand-text">Planner — контент-стратег</h2>
          <p className="mt-0.5 text-sm text-brand-text-secondary">
            Upstream-агент: из воронки, сегментов и целей стратегии собирает контент-план. Работает в Cowork.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center">
        {/* карточка агента */}
        <button
          type="button"
          onClick={() => onSelect({ kind: 'planner', planner })}
          className={`w-full shrink-0 cursor-pointer rounded-xl border bg-card px-3 py-2.5 text-left shadow-soft transition-all lg:w-64 ${
            nodeSelected
              ? 'border-primary-500 ring-2 ring-primary-400/40'
              : 'border-primary-300 hover:border-primary-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0 text-primary-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-text">🧭 Planner</span>
            <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
              AI-агент
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-brand-text-secondary/70">
              читает
            </span>
            <div className="flex flex-wrap gap-1">
              {planner.reads.map((r) => (
                <span
                  key={r.slug}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-brand-text-secondary"
                  title={r.slug}
                >
                  {r.title}
                </span>
              ))}
            </div>
          </div>
        </button>

        {/* стрелка → контент-план */}
        <div className="flex items-center gap-1 self-center text-brand-text-secondary lg:self-auto">
          <ArrowRight className="h-4 w-4" />
        </div>

        {/* produces: контент-план */}
        <button
          type="button"
          onClick={() => onSelect({ kind: 'doc', slug: produces.slug })}
          className={`flex w-full shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-all lg:w-56 ${
            producesSelected
              ? 'border-primary-500 ring-2 ring-primary-400/40'
              : 'border-brand-border hover:border-primary-300 hover:shadow-sm'
          }`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-primary-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-brand-text">→ {produces.title}</div>
            <div className="truncate font-mono text-[10px] text-brand-text-secondary/70">{produces.slug}</div>
          </div>
          {(() => {
            const d = docs[produces.slug]
            return !d || !d.content ? (
              <span className="shrink-0 text-[10px] text-brand-text-secondary/70">(пусто)</span>
            ) : null
          })()}
        </button>
      </div>
    </section>
  )
}

// ─── Дерево целиком ────────────────────────────────────────────────────────────

export const EngineTree = ({ planner, contentTypes, docs, selected, onSelect }: EngineTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(contentTypes.map((c) => c.type)))

  const toggle = (type: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {planner && (
        <PlannerNode planner={planner} docs={docs} selected={selected} onSelect={onSelect} />
      )}

      {contentTypes.length === 0 ? (
        <section className="card py-12 text-center">
          <p className="text-brand-text-secondary">Рецептов пока нет — движок не сконфигурирован.</p>
        </section>
      ) : null}

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
