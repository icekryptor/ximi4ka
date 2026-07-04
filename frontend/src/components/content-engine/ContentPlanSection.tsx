import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  ContentPlanItem,
  ContentPlanStatus,
  FunnelLevel,
  contentPlanApi,
} from '../../api/contentPlan'
import { icpSegmentsApi } from '../../api/icpSegments'
import { strategicThemesApi } from '../../api/strategicThemes'
import { IcpSegment, StrategicTheme } from '../../api/types'
import { errorMessage } from '../marketing/utils'

// ─── Воронка-бейджи (цветные) ────────────────────────────────────────────────

const FUNNEL_TONE: Record<FunnelLevel, string> = {
  TOFU: 'bg-sky-100 text-sky-700',
  MOFU: 'bg-violet-100 text-violet-700',
  BOFU: 'bg-emerald-100 text-emerald-700',
}

const FunnelBadge = ({ level }: { level: string | null }) => {
  if (!level) return <span className="text-brand-text-secondary/50">—</span>
  const tone = FUNNEL_TONE[level as FunnelLevel] ?? 'bg-muted text-brand-text-secondary'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{level}</span>
  )
}

// ─── Статус-бейджи ────────────────────────────────────────────────────────────

const STATUSES: { value: ContentPlanStatus; label: string; tone: string }[] = [
  { value: 'planned', label: 'запланировано', tone: 'bg-muted text-brand-text-secondary' },
  { value: 'in_progress', label: 'в работе', tone: 'bg-amber-100 text-amber-700' },
  { value: 'published', label: 'опубликовано', tone: 'bg-emerald-100 text-emerald-700' },
]

// ─── Секция «Актуальный контент-план» ────────────────────────────────────────

interface ContentPlanSectionProps {
  // Клик по «Открыть/редактировать» → показать markdown-план в правой панели.
  onOpenDoc: (slug: string) => void
}

const PLAN_DOC_SLUG = 'content_plan_current'

export const ContentPlanSection = ({ onOpenDoc }: ContentPlanSectionProps) => {
  const [items, setItems] = useState<ContentPlanItem[]>([])
  const [docTitle, setDocTitle] = useState<string | null>(null)
  const [hasDocContent, setHasDocContent] = useState(false)
  const [segments, setSegments] = useState<IcpSegment[]>([])
  const [themes, setThemes] = useState<StrategicTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const segName = useMemo(() => {
    const m = new Map(segments.map((s) => [s.id, s.name]))
    return (id: string | null) => (id ? m.get(id) ?? '—' : '—')
  }, [segments])
  const themeName = useMemo(() => {
    const m = new Map(themes.map((t) => [t.id, t.name]))
    return (id: string | null) => (id ? m.get(id) ?? '—' : '—')
  }, [themes])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [plan, segs, ths] = await Promise.all([
        contentPlanApi.get(),
        icpSegmentsApi.getAll().catch(() => [] as IcpSegment[]),
        strategicThemesApi.getAll().catch(() => [] as StrategicTheme[]),
      ])
      setItems(plan.items)
      setDocTitle(plan.doc?.title ?? null)
      setHasDocContent(!!plan.doc?.content?.trim())
      setSegments(segs)
      setThemes(ths)
    } catch (e) {
      setError(errorMessage(e, 'Не удалось загрузить контент-план'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const addRow = async () => {
    setAdding(true)
    try {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0
      const created = await contentPlanApi.createItem({ status: 'planned', sort_order: nextOrder })
      setItems((prev) => [...prev, created])
    } catch (e) {
      setError(errorMessage(e, 'Не удалось добавить строку'))
    } finally {
      setAdding(false)
    }
  }

  const changeStatus = async (id: string, status: ContentPlanStatus) => {
    setBusyId(id)
    try {
      const updated = await contentPlanApi.updateItem(id, { status })
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    } catch (e) {
      setError(errorMessage(e, 'Не удалось обновить статус'))
    } finally {
      setBusyId(null)
    }
  }

  const removeRow = async (id: string) => {
    setBusyId(id)
    try {
      await contentPlanApi.deleteItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      setError(errorMessage(e, 'Не удалось удалить строку'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <h2 className="text-lg font-semibold text-brand-text">Актуальный контент-план</h2>
            <p className="mt-0.5 text-sm text-brand-text-secondary">
              Строки-индекс плана. Полный текст — в документе{' '}
              <span className="font-mono">{PLAN_DOC_SLUG}</span>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenDoc(PLAN_DOC_SLUG)}
          className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-card px-3 py-1.5 text-sm text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700"
        >
          <ExternalLink className="h-4 w-4" />
          {hasDocContent ? 'Открыть/редактировать' : 'План ещё не составлен'}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-border py-10 text-center">
          <p className="mb-1 text-brand-text-secondary">Плана ещё нет.</p>
          <p className="mb-4 text-sm text-brand-text-secondary/70">
            Собери контент-план через Planner в Cowork и добавь строки-индекс сюда.
          </p>
          <button
            type="button"
            onClick={() => void addRow()}
            disabled={adding}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добавить строку
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs uppercase tracking-wide text-brand-text-secondary/70">
                  <th className="px-2 py-2 font-medium">Дата</th>
                  <th className="px-2 py-2 font-medium">Воронка</th>
                  <th className="px-2 py-2 font-medium">Сегмент</th>
                  <th className="px-2 py-2 font-medium">Тема</th>
                  <th className="px-2 py-2 font-medium">Формат</th>
                  <th className="px-2 py-2 font-medium">Цель</th>
                  <th className="px-2 py-2 font-medium">Статус</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const busy = busyId === it.id
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-brand-border/60 ${busy ? 'opacity-60' : ''}`}
                    >
                      <td className="whitespace-nowrap px-2 py-2 text-brand-text">
                        {it.plan_date ?? <span className="text-brand-text-secondary/50">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        <FunnelBadge level={it.funnel_level} />
                      </td>
                      <td className="px-2 py-2 text-brand-text">{segName(it.segment_id)}</td>
                      <td className="px-2 py-2 text-brand-text">{themeName(it.theme_id)}</td>
                      <td className="px-2 py-2 text-brand-text">
                        {it.format ?? <span className="text-brand-text-secondary/50">—</span>}
                      </td>
                      <td className="max-w-[16rem] px-2 py-2 text-brand-text-secondary">
                        {it.goal ? (
                          <span className="line-clamp-2">{it.goal}</span>
                        ) : (
                          <span className="text-brand-text-secondary/50">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={it.status}
                          disabled={busy}
                          onChange={(e) => void changeStatus(it.id, e.target.value as ContentPlanStatus)}
                          className="rounded-lg border border-brand-border bg-card px-2 py-1 text-xs text-brand-text focus:border-primary-400 focus:outline-none"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                          {!STATUSES.some((s) => s.value === it.status) && (
                            <option value={it.status}>{it.status}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void removeRow(it.id)}
                          disabled={busy}
                          className="rounded-lg p-1 text-brand-text-secondary/60 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Удалить строку"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => void addRow()}
              disabled={adding}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-brand-border px-3 py-1.5 text-sm text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить строку
            </button>
          </div>
        </>
      )}
    </section>
  )
}
