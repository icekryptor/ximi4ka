import { useState } from 'react'
import { ChevronDown, ChevronRight, Compass, HelpCircle, PenLine, Plug, Sparkles } from 'lucide-react'

const MCP_URL = 'https://ximi4kafinance-production.up.railway.app/mcp'

/**
 * Коллапсибл-гайд «Как работать с агентами через Cowork».
 * Двухагентный цикл: Planner (планирует) → Writer (пишет по плану).
 * Агенты работают в Claude Desktop Cowork и через MCP-коннектор читают
 * живой контекст из БД и пишут результат обратно — без файлов-знаний.
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
          {/* Подключение MCP */}
          <div className="rounded-2xl border border-primary-300 bg-primary-50/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Plug className="h-4 w-4 shrink-0 text-primary-600" />
              <h3 className="text-sm font-semibold text-brand-text">
                Шаг 0 — подключи MCP-коннектор (один раз)
              </h3>
            </div>
            <ol className="ml-1 flex flex-col gap-1.5 text-sm text-brand-text-secondary">
              <li>1. Claude Desktop → Settings → Connectors → Add custom connector.</li>
              <li>
                2. Тип <b>HTTP</b>, URL: <span className="font-mono break-all">{MCP_URL}</span>
              </li>
              <li>
                3. Заголовок авторизации:{' '}
                <span className="font-mono">Authorization: Bearer &lt;MCP_ACCESS_TOKEN&gt;</span> (токен — в
                Railway env, спроси у админа).
              </li>
              <li>
                4. Готово: агент видит инструменты и сам берёт контекст из БД. <b>Файлы-знания больше не
                нужны</b> — данные всегда актуальные.
              </li>
            </ol>
          </div>

          {/* Planner */}
          <div className="rounded-2xl border border-brand-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Compass className="h-4 w-4 shrink-0 text-primary-600" />
              <h3 className="text-sm font-semibold text-brand-text">🧭 Planner — планирует повестку</h3>
            </div>
            <ol className="ml-1 flex flex-col gap-1.5 text-sm text-brand-text-secondary">
              <li>1. Открой сессию Planner в Claude Desktop (проект Химички с подключённым коннектором).</li>
              <li>
                2. Агент вызывает <span className="font-mono">planner_context</span> — получает воронку, ЦА и
                цели стратегии прямо из БД.
              </li>
              <li>3. Составляет контент-план (дата, воронка, сегмент, тема, формат, цель).</li>
              <li>
                4. Пишет результат обратно: <span className="font-mono">save_content_plan</span> (markdown) +{' '}
                <span className="font-mono">add_plan_item</span> (строки индекса). Ничего копировать вручную не
                надо.
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
                1. Агент вызывает{' '}
                <span className="font-mono">writer_context(segment_slug, rubric_slug)</span> — получает
                стиль-гайды, матрицу рубрик, фазу стратегии, план и деталь сегмента.
              </li>
              <li>
                2. При необходимости уточняет справочники:{' '}
                <span className="font-mono">list_segments</span>, <span className="font-mono">list_rubrics</span>,{' '}
                <span className="font-mono">list_plan_items</span>.
              </li>
              <li>3. Пишет пост в стиле бренда по повестке плана, редактируешь результат.</li>
            </ol>
          </div>

          {/* Список инструментов */}
          <div className="rounded-2xl border border-brand-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-brand-text">Инструменты MCP (9)</h3>
            <div className="grid grid-cols-1 gap-1 text-xs text-brand-text-secondary sm:grid-cols-2">
              <span>
                <span className="font-mono text-brand-text">planner_context</span> — контекст планировщика
              </span>
              <span>
                <span className="font-mono text-brand-text">writer_context</span> — контекст копирайтера
              </span>
              <span>
                <span className="font-mono text-brand-text">list_plan_items</span> — строки плана
              </span>
              <span>
                <span className="font-mono text-brand-text">list_segments</span> — справочник ЦА
              </span>
              <span>
                <span className="font-mono text-brand-text">list_rubrics</span> — справочник рубрик
              </span>
              <span>
                <span className="font-mono text-brand-text">save_content_plan</span> — сохранить план
              </span>
              <span>
                <span className="font-mono text-brand-text">add_plan_item</span> — добавить строку
              </span>
              <span>
                <span className="font-mono text-brand-text">update_plan_item</span> — обновить строку
              </span>
              <span>
                <span className="font-mono text-brand-text">delete_plan_item</span> — удалить строку
              </span>
            </div>
          </div>

          {/* волна 2 */}
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-primary-300 bg-primary-50/40 p-3 text-sm text-brand-text-secondary">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            <p>
              <span className="font-semibold text-brand-text">Волна 2 (скоро):</span> цикл самообучения Writer'а —
              обратная связь → анализ → learned-документ (тоже через MCP-инструменты), чтобы посты становились
              лучше со временем.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
