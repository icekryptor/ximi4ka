import { useState } from 'react'
import { ChevronDown, ChevronRight, Compass, HelpCircle, PenLine, Sparkles } from 'lucide-react'

/**
 * Коллапсибл-гайд «Как работать с агентами через Cowork».
 * Двухагентный цикл волны 1: Planner (планирует) → Writer (пишет по плану).
 * Оба агента работают в Claude Desktop Cowork (Max-подписка), ERP хранит
 * состояние и отдаёт промпты для копи-паста. Ноль вызовов API.
 */
export const CoworkGuide = () => {
  const [open, setOpen] = useState(false)

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-brand-text-secondary" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-brand-text-secondary" />
        )}
        <HelpCircle className="h-5 w-5 shrink-0 text-primary-600" />
        <h2 className="text-lg font-semibold text-brand-text">Как работать с агентами через Cowork</h2>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Planner */}
          <div className="rounded-2xl border border-brand-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Compass className="h-4 w-4 shrink-0 text-primary-600" />
              <h3 className="text-sm font-semibold text-brand-text">🧭 Planner — планирует повестку</h3>
            </div>
            <ol className="ml-1 flex flex-col gap-1.5 text-sm text-brand-text-secondary">
              <li>1. Открой Claude Desktop Cowork (проект Химички).</li>
              <li>
                2. Скопируй промпт Planner (кнопка «Копировать» в панели узла 🧭 Planner) — он уже собран из
                воронки, ЦА и целей стратегии.
              </li>
              <li>3. Получи контент-план (markdown-таблица: дата, воронка, сегмент, тема, формат, цель).</li>
              <li>
                4. Сохрани план в ERP: текст → документ <span className="font-mono">content_plan_current</span>,
                строки → индекс в секции «Актуальный контент-план».
              </li>
            </ol>
          </div>

          {/* Writer */}
          <div className="rounded-2xl border border-brand-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <PenLine className="h-4 w-4 shrink-0 text-primary-600" />
              <h3 className="text-sm font-semibold text-brand-text">✍️ Writer — пишет по плану</h3>
            </div>
            <ol className="ml-1 flex flex-col gap-1.5 text-sm text-brand-text-secondary">
              <li>
                1. Writer читает <span className="font-mono">content_plan_current</span> как повестку (веточка
                появляется в рецептах автоматически).
              </li>
              <li>2. Возьми промпт нужного шага рецепта, вставь в Cowork, сгенерируй пост по плану.</li>
              <li>3. Отредактируй результат и сохрани в контент-банк.</li>
            </ol>
          </div>

          {/* волна 2 */}
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-primary-300 bg-primary-50/40 p-3 text-sm text-brand-text-secondary">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            <p>
              <span className="font-semibold text-brand-text">Волна 2 (скоро):</span> цикл самообучения Writer'а —
              обратная связь → анализ → learned-документ, чтобы посты становились лучше со временем.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
