import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Download,
  Upload,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import {
  unitsApi,
  rubricsApi,
  ContentUnit,
  ContentRubric,
  ContentStatus,
  ContentType,
  PaginationMeta,
  STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  COMPLEXITY_LABELS,
  REVIEW_GRADE_LABELS,
  ReviewGrade,
} from '../api/contentBank'
import { contentEngineApi, DashboardData, StageKey } from '../api/contentEngine'
import { MetricsRow } from '../components/content-engine/MetricsRow'
import { PipelineRow } from '../components/content-engine/PipelineRow'
import { Bottlenecks } from '../components/content-engine/Bottlenecks'
import { TodayQueue } from '../components/content-engine/TodayQueue'
import { RecentPublished } from '../components/content-engine/RecentPublished'
import { KNOWN_NETWORKS } from '../lib/networks'
import { useToast } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { UnitChip } from '../components/content-bank/UnitChip'
import { UnitEditModal } from '../components/content-bank/UnitEditModal'
import { RubricsManagerModal } from '../components/content-bank/RubricsManagerModal'
import ImportJsonModal from '../components/content-bank/ImportJsonModal'

function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-brand-text-secondary w-20 shrink-0">{label}:</span>
      <button
        onClick={() => onChange([])}
        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
          selected.length === 0
            ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
        }`}
      >
        Все
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            selected.includes(o.value)
              ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
              : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

/**
 * Earliest scheduled publication date for a unit, or null if none.
 * Filters out unscheduled publications (no scheduled_at) and sorts ISO
 * strings — works because ISO 8601 sort is chronological.
 */
function earliestScheduledAt(publications: ContentUnit['publications']): string | null {
  const dates = publications
    .map((p) => p.scheduled_at)
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .sort()
  return dates[0] ?? null
}

export default function ContentBank() {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [items, setItems] = useState<ContentUnit[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])
  const [editingUnit, setEditingUnit] = useState<ContentUnit | 'new' | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardFetching, setDashboardFetching] = useState(false)
  const [rubricsManagerOpen, setRubricsManagerOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [ungraded, setUngraded] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const reqIdRef = useRef(0)
  // Ref to toast so load() can read it without making toast a dep. Prevents
  // an infinite retry loop if the toast context ever returns a new reference
  // on a re-render (an old footgun with non-memoised provider values).
  const toastRef = useRef(toast)
  toastRef.current = toast

  // Filters from URL
  const statusFilter =
    (searchParams.get('status')?.split(',').filter(Boolean) as ContentStatus[]) || []
  const rubricFilter = searchParams.get('rubric_id')?.split(',').filter(Boolean) || []
  const typeFilter =
    (searchParams.get('content_type')?.split(',').filter(Boolean) as ContentType[]) || []
  const networkFilter = searchParams.get('network')?.split(',').filter(Boolean) || []
  const reviewGradeFilter = searchParams.get('review_grade')?.split(',').filter(Boolean) || []
  const searchFromUrl = searchParams.get('search') || ''
  const sort =
    (searchParams.get('sort') as
      | 'created_at'
      | 'title'
      | 'status'
      | 'ready_at'
      | 'scheduled_at') ||
    'scheduled_at'
  const stage = (searchParams.get('stage') as StageKey | null) || null
  const schedFrom = searchParams.get('scheduled_at_from') || ''
  const schedTo = searchParams.get('scheduled_at_to') || ''
  const page = parseInt(searchParams.get('page') || '1', 10) || 1

  // Local search input mirrors URL but updates with debounce
  const [searchInput, setSearchInput] = useState(searchFromUrl)

  // Sync URL → input when URL changes externally
  useEffect(() => {
    setSearchInput(searchFromUrl)
  }, [searchFromUrl])

  // Debounce input → URL
  useEffect(() => {
    if (searchInput === searchFromUrl) return
    const t = setTimeout(() => {
      setSearchParams((prev) => {
        const sp = new URLSearchParams(prev)
        if (searchInput) sp.set('search', searchInput)
        else sp.delete('search')
        sp.delete('page')
        return sp
      })
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput, searchFromUrl, setSearchParams])

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 50, page, sort }
      if (statusFilter.length > 0) params.status = statusFilter.join(',')
      if (rubricFilter.length > 0) params.rubric_id = rubricFilter.join(',')
      if (typeFilter.length > 0) params.content_type = typeFilter.join(',')
      if (networkFilter.length > 0) params.network = networkFilter.join(',')
      if (reviewGradeFilter.length > 0) params.review_grade = reviewGradeFilter.join(',')
      if (searchFromUrl) params.search = searchFromUrl
      if (stage) params.stage = stage
      if (schedFrom) params.scheduled_at_from = schedFrom
      if (schedTo) params.scheduled_at_to = schedTo
      const r = await unitsApi.list(params)
      if (reqId !== reqIdRef.current) return
      setItems(r.data)
      setPagination(r.pagination)
    } catch {
      if (reqId !== reqIdRef.current) return
      toastRef.current.error('Ошибка загрузки контент-банка')
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
    // searchParams covers all filter/sort/page state since they're derived from it.
    // toast is intentionally NOT in deps — we read it through toastRef so an
    // unstable toast reference (if it ever happens) doesn't cause load to
    // recreate and trigger an infinite retry loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  // Load rubrics once
  useEffect(() => {
    rubricsApi
      .getAll()
      .then(setRubrics)
      .catch(() => toast.error('Не удалось загрузить рубрики'))
  }, [toast])

  const loadUngradedCount = useCallback(async () => {
    try {
      const r = await unitsApi.ungradedCount()
      setUngraded(r.count)
    } catch {
      // silent — non-critical
    }
  }, [])

  const loadRejectedCount = useCallback(async () => {
    try {
      const r = await unitsApi.rejectedCount()
      setRejectedCount(r.count)
    } catch {
      // silent — non-critical
    }
  }, [])

  const refreshDashboard = useCallback(async () => {
    setDashboardFetching(true)
    try {
      const r = await contentEngineApi.stats()
      setDashboard(r)
    } catch {
      // Silent failure — keep previous data, never disrupt the table
    } finally {
      setDashboardFetching(false)
    }
  }, [])

  useEffect(() => {
    loadUngradedCount()
    loadRejectedCount()
  }, [loadUngradedCount, loadRejectedCount])

  // Dashboard data — initial load + 30s polling, paused while modal is open or tab hidden
  useEffect(() => {
    refreshDashboard()
    const tick = () => {
      if (document.hidden) return
      if (editingUnit !== null) return
      refreshDashboard()
    }
    const timer = setInterval(tick, 30000)
    const onVisibility = () => {
      if (!document.hidden && editingUnit === null) refreshDashboard()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [editingUnit, refreshDashboard])

  const handlePurgeRejected = useCallback(async () => {
    const ok = await confirm({
      title: 'Удалить отказные идеи?',
      message: `Будет удалено ${rejectedCount} идей со статусом «❌ отказ» вместе с их публикациями. Действие нельзя отменить.`,
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const r = await unitsApi.purgeRejected()
      toast.success(`Удалено ${r.deleted} идей`)
      await Promise.all([load(), loadUngradedCount(), loadRejectedCount()])
    } catch {
      toast.error('Ошибка удаления отказов')
    }
  }, [confirm, rejectedCount, toast, load, loadUngradedCount, loadRejectedCount])

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить единицу?',
      message:
        'Будет удалена единица контента и все её публикации. Действие нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await unitsApi.delete(id)
      toast.success('Удалено')
      load()
    } catch {
      toast.error('Не удалось удалить')
    }
  }

  const updateParam = (key: string, values: string[]) => {
    const sp = new URLSearchParams(searchParams)
    if (values.length === 0) sp.delete(key)
    else sp.set(key, values.join(','))
    sp.delete('page') // reset to page 1 on filter change
    setSearchParams(sp)
  }

  const updateSort = (next: string) => {
    const sp = new URLSearchParams(searchParams)
    if (!next || next === 'created_at') sp.delete('sort')
    else sp.set('sort', next)
    sp.delete('page')
    setSearchParams(sp)
  }

  const updatePage = (next: number) => {
    const sp = new URLSearchParams(searchParams)
    if (next <= 1) sp.delete('page')
    else sp.set('page', String(next))
    setSearchParams(sp)
  }

  const typeOptions = (Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((v) => ({
    value: v,
    label: CONTENT_TYPE_LABELS[v],
  }))

  const rubricOptions = rubrics.map((r) => ({
    value: r.id,
    label: `${r.emoji ?? ''} ${r.title}`.trim(),
  }))

  const networkOptions = KNOWN_NETWORKS.map((n) => ({ value: n.value, label: n.label }))

  const statusOptions = (Object.keys(STATUS_LABELS) as ContentStatus[]).map((v) => ({
    value: v,
    label: STATUS_LABELS[v],
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg sm:text-xl font-bold text-brand-text">Контент-банк</h1>
          {dashboard && (
            <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
              <span
                className={
                  'inline-block w-2 h-2 rounded-full ' +
                  (dashboardFetching ? 'bg-primary-500 animate-pulse' : 'bg-green-500')
                }
                aria-label={dashboardFetching ? 'Обновляется' : 'Актуально'}
              />
              <span>Обновлено: {new Date(dashboard.generated_at).toLocaleTimeString('ru-RU')}</span>
              <button
                onClick={refreshDashboard}
                disabled={dashboardFetching}
                className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-50"
              >
                <RefreshCw size={12} className={dashboardFetching ? 'animate-spin' : ''} /> Обновить
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={sort}
            onChange={(e) => updateSort(e.target.value)}
            className="input text-sm py-1.5 shrink-0"
            title="Сортировка"
          >
            <option value="created_at">Сначала новые</option>
            <option value="title">По алфавиту</option>
            <option value="status">По статусу</option>
            <option value="ready_at">📅 По дате готовности</option>
            <option value="scheduled_at">🚀 По дате публикации</option>
          </select>
          {/* Date range filter on content_publications.scheduled_at — both
              bounds optional, URL-stateful. Matches units with ANY publication
              scheduled in range. */}
          <div
            className="flex items-center gap-1 text-xs text-brand-text-secondary shrink-0"
            title="Фильтр по дате запланированной публикации"
          >
            <span aria-hidden>🚀</span>
            <input
              type="date"
              value={schedFrom}
              onChange={(e) => {
                const v = e.target.value
                setSearchParams((prev) => {
                  const sp = new URLSearchParams(prev)
                  if (v) sp.set('scheduled_at_from', v)
                  else sp.delete('scheduled_at_from')
                  sp.delete('page')
                  return sp
                })
              }}
              className="text-xs px-2 py-1 rounded border border-brand-border bg-card text-brand-text"
              title="Дата публикации: от"
            />
            <span aria-hidden>—</span>
            <input
              type="date"
              value={schedTo}
              onChange={(e) => {
                const v = e.target.value
                setSearchParams((prev) => {
                  const sp = new URLSearchParams(prev)
                  if (v) sp.set('scheduled_at_to', v)
                  else sp.delete('scheduled_at_to')
                  sp.delete('page')
                  return sp
                })
              }}
              className="text-xs px-2 py-1 rounded border border-brand-border bg-card text-brand-text"
              title="Дата публикации: до"
            />
            {(schedFrom || schedTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchParams((prev) => {
                    const sp = new URLSearchParams(prev)
                    sp.delete('scheduled_at_from')
                    sp.delete('scheduled_at_to')
                    sp.delete('page')
                    return sp
                  })
                }}
                className="px-1.5 py-1 rounded hover:bg-subtle text-brand-text-secondary"
                title="Сбросить фильтр по датам"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/content-bank/triage')}
            className="btn btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0"
            title="Режим триажа — оценка идей"
          >
            <Sparkles size={16} />
            <span className="hidden sm:inline">Триаж{ungraded > 0 ? ` (${ungraded})` : ''}</span>
          </button>

          {rejectedCount > 0 && (
            <button
              onClick={handlePurgeRejected}
              className="btn flex items-center gap-2 border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 dark:border-red-800 dark:text-red-400 whitespace-nowrap shrink-0"
              title="Удалить все идеи со статусом «отказ»"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Отказы ({rejectedCount})</span>
            </button>
          )}

          <button
            onClick={() => setImportModalOpen(true)}
            className="btn btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0"
            title="Импорт из JSON"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Импорт</span>
          </button>

          <button
            onClick={async () => {
              try {
                const params: Record<string, string> = {}
                const sp = searchParams
                for (const k of ['status', 'rubric_id', 'content_type', 'network', 'review_grade', 'search']) {
                  const v = sp.get(k)
                  if (v) params[k] = v
                }
                const blob = await unitsApi.export(params)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `content-bank-export-${Date.now()}.json`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
                toast.success(`Экспортировано: ${Math.round(blob.size / 1024)} KB`)
              } catch {
                toast.error('Ошибка экспорта')
              }
            }}
            className="btn btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0"
            title="Экспорт в JSON"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Экспорт</span>
          </button>

          <button
            onClick={() => setRubricsManagerOpen(true)}
            className="btn btn-secondary flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Рубрики</span>
          </button>
          <button
            onClick={() => setEditingUnit('new')}
            className="btn btn-primary flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus size={16} />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {dashboard && (
        <div className="space-y-4 mb-4">
          <MetricsRow stats={dashboard.stats} />
          <Bottlenecks counts={dashboard.stats.counts} />
          <TodayQueue
            queue={dashboard.today_queue}
            onUnitClick={async (unitId) => {
              try {
                const unit = await unitsApi.getOne(unitId)
                setEditingUnit(unit)
              } catch {
                toastRef.current.error('Не удалось загрузить юнит')
              }
            }}
          />
        </div>
      )}

      {dashboard && (
        <div className="mb-4">
          <PipelineRow
            counts={dashboard.stats.counts}
            openStage={stage}
            onStageClick={(s) => {
              setSearchParams((prev) => {
                const sp = new URLSearchParams(prev)
                if (stage === s) {
                  sp.delete('stage')
                } else {
                  sp.set('stage', s)
                  // mutual exclusion: stage replaces status + review_grade filters
                  sp.delete('status')
                  sp.delete('review_grade')
                }
                sp.delete('page')
                return sp
              })
            }}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-secondary" />
          <input
            type="text"
            placeholder="Поиск по названию, hook, описанию..."
            className="input pl-10 w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <FilterChipBar
          label="Тип"
          options={typeOptions}
          selected={typeFilter}
          onChange={(next) => updateParam('content_type', next)}
        />
        <FilterChipBar
          label="Сети"
          options={networkOptions}
          selected={networkFilter}
          onChange={(next) => updateParam('network', next)}
        />
        <FilterChipBar
          label="Оценка"
          options={[
            { value: 'excellent', label: REVIEW_GRADE_LABELS.excellent },
            { value: 'needs_work', label: REVIEW_GRADE_LABELS.needs_work },
            { value: 'rejected', label: REVIEW_GRADE_LABELS.rejected },
            { value: 'null', label: '— не оценено —' },
          ]}
          selected={reviewGradeFilter}
          onChange={(next) => updateParam('review_grade', next)}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Нет единиц контента</div>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">
                    Контент
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Сети
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    {/* действия */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setEditingUnit(u)}
                    className="border-b border-brand-border hover:bg-subtle cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {u.rubric && (
                          <UnitChip variant="rubric">
                            {u.rubric.emoji} {u.rubric.title}
                          </UnitChip>
                        )}
                        <UnitChip variant="status" status={u.status}>
                          {STATUS_LABELS[u.status]}
                        </UnitChip>
                        <UnitChip variant="type" contentType={u.content_type}>
                          {CONTENT_TYPE_LABELS[u.content_type]}
                        </UnitChip>
                        {u.complexity != null && COMPLEXITY_LABELS[u.complexity] && (
                          <UnitChip variant="complexity">
                            {COMPLEXITY_LABELS[u.complexity]}
                          </UnitChip>
                        )}
                        {(() => {
                          // Show earliest scheduled publication date — the
                          // content-bank doubles as a publication calendar.
                          // Falls back to ready_at (planned readiness) when no
                          // publication is scheduled yet, so units in early
                          // stages still show their target date.
                          const sched = earliestScheduledAt(u.publications)
                          const dateIso = sched ?? u.ready_at
                          if (!dateIso) return null
                          const isScheduled = !!sched
                          const highlighted =
                            (isScheduled && sort === 'scheduled_at') ||
                            (!isScheduled && sort === 'ready_at')
                          return (
                            <span
                              className={
                                'ml-auto text-xs ' +
                                (highlighted
                                  ? 'text-primary-600 font-medium'
                                  : 'text-brand-text-secondary')
                              }
                              title={isScheduled ? 'Ближайшая публикация' : 'Плановая готовность'}
                            >
                              {isScheduled ? '🚀' : '↗'} {formatShortDate(dateIso)}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="font-semibold text-brand-text leading-snug">
                        {u.title}
                      </div>
                      {u.hook && (
                        <div className="text-sm text-brand-text-secondary mt-0.5 line-clamp-1">
                          → {u.hook}
                        </div>
                      )}
                      {u.script_text && (
                        <div className="text-xs text-brand-text-secondary mt-1.5 line-clamp-3 whitespace-pre-line">
                          {u.script_text}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {/* Cap visible chips at 3. When publications.length > 3,
                            the third slot becomes a counter "+N" showing the
                            number of hidden networks. Keeps the column compact
                            for units published to many channels. */}
                        {(() => {
                          const pubs = u.publications
                          if (pubs.length <= 3) {
                            return pubs.map((p) => (
                              <span
                                key={p.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary"
                              >
                                {p.network}
                              </span>
                            ))
                          }
                          const visible = pubs.slice(0, 2)
                          const hiddenCount = pubs.length - 2
                          return (
                            <>
                              {visible.map((p) => (
                                <span
                                  key={p.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary"
                                >
                                  {p.network}
                                </span>
                              ))}
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary font-medium"
                                title={pubs
                                  .slice(2)
                                  .map((p) => p.network)
                                  .join(', ')}
                              >
                                +{hiddenCount}
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingUnit(u)}
                          className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-brand-text-secondary">
              Показано {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} из{' '}
              {pagination.total}
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updatePage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => updatePage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-primary-500 text-white'
                          : 'border border-brand-border hover:bg-subtle text-brand-text-secondary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => updatePage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-2 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Следующая страница"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {dashboard && dashboard.recent_published.length > 0 && (
        <div className="mt-6">
          <RecentPublished items={dashboard.recent_published} />
        </div>
      )}

      {editingUnit !== null && (
        <UnitEditModal
          unit={editingUnit}
          onSaved={(saved) => {
            // Splice the saved unit into local state so closing the modal
            // doesn't force a 1-2s round-trip to Supabase Singapore.
            setItems((prev) => {
              const idx = prev.findIndex((u) => u.id === saved.id)
              if (idx >= 0) {
                const next = prev.slice()
                next[idx] = saved
                return next
              }
              // New unit — prepend so the user sees it immediately. The next
              // genuine load() (filter/sort/page change) will place it
              // correctly per server-side ordering.
              return [saved, ...prev]
            })
          }}
          onClose={() => setEditingUnit(null)}
        />
      )}

      {rubricsManagerOpen && (
        <RubricsManagerModal
          onClose={() => {
            setRubricsManagerOpen(false)
            // Refresh rubrics list so chip filter and dropdowns reflect changes
            rubricsApi
              .getAll()
              .then(setRubrics)
              .catch(() => toast.error('Не удалось загрузить рубрики'))
          }}
        />
      )}

      {importModalOpen && (
        <ImportJsonModal
          onClose={() => {
            setImportModalOpen(false)
            load()
            loadUngradedCount()
            // Rubrics may have been created during import — refresh chip filter list
            rubricsApi
              .getAll()
              .then(setRubrics)
              .catch(() => toast.error('Не удалось загрузить рубрики'))
          }}
        />
      )}
    </div>
  )
}
