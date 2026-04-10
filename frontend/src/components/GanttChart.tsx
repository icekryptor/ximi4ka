import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { ProjectTask, TaskDependency } from '../api/projects'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GanttChartProps {
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
  viewMode: 'day' | 'week' | 'month'
  onTaskClick?: (task: ProjectTask) => void
  onProgressChange?: (taskId: string, progress: number) => void
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void
}

interface ComputedTask extends ProjectTask {
  level: number
  isParent: boolean
}

interface Column {
  key: string
  label: string
  subLabel?: string
  startDate: Date
  endDate: Date
  isWeekend: boolean
  isToday: boolean
  widthPx: number
}

interface TooltipState {
  task: ProjectTask
  x: number
  y: number
}

interface DragState {
  taskId: string
  edge: 'left' | 'right' | 'move'
  startMouseX: number
  origStartDate: Date
  origEndDate: Date
  currentStartDate: Date
  currentEndDate: Date
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 280
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 56
const DAY_WIDTH = 40
const WEEK_WIDTH = 120
const MONTH_WIDTH = 200

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const MONTHS_RU_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]
const DAYS_RU_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : startOfDay(d)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

// ─── Build columns ────────────────────────────────────────────────────────────

function buildDayColumns(start: Date, end: Date): Column[] {
  const cols: Column[] = []
  let cur = startOfDay(start)
  const today = startOfDay(new Date())
  while (cur <= end) {
    const next = addDays(cur, 1)
    cols.push({
      key: cur.toISOString(),
      label: String(cur.getDate()),
      subLabel: DAYS_RU_SHORT[cur.getDay()],
      startDate: new Date(cur),
      endDate: next,
      isWeekend: isWeekend(cur),
      isToday: cur.getTime() === today.getTime(),
      widthPx: DAY_WIDTH,
    })
    cur = next
  }
  return cols
}

function buildWeekColumns(start: Date, end: Date): Column[] {
  const cols: Column[] = []
  // Snap to Monday of the week containing start
  const first = startOfDay(start)
  const dayOfWeek = (first.getDay() + 6) % 7 // Mon=0
  let cur = addDays(first, -dayOfWeek)
  const today = startOfDay(new Date())

  while (cur <= end) {
    const weekEnd = addDays(cur, 6)
    const weekNum = getISOWeek(cur)
    const isCurrentWeek =
      today >= cur && today <= weekEnd
    cols.push({
      key: cur.toISOString(),
      label: `Нед. ${weekNum}`,
      subLabel: `${cur.getDate()} ${MONTHS_RU_SHORT[cur.getMonth()]}`,
      startDate: new Date(cur),
      endDate: addDays(cur, 7),
      isWeekend: false,
      isToday: isCurrentWeek,
      widthPx: WEEK_WIDTH,
    })
    cur = addDays(cur, 7)
  }
  return cols
}

function buildMonthColumns(start: Date, end: Date): Column[] {
  const cols: Column[] = []
  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const today = startOfDay(new Date())

  while (cur <= end) {
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const isCurrentMonth = today.getFullYear() === cur.getFullYear() && today.getMonth() === cur.getMonth()
    cols.push({
      key: cur.toISOString(),
      label: MONTHS_RU[cur.getMonth()],
      subLabel: String(cur.getFullYear()),
      startDate: new Date(cur),
      endDate: nextMonth,
      isWeekend: false,
      isToday: isCurrentMonth,
      widthPx: MONTH_WIDTH,
    })
    cur = nextMonth
  }
  return cols
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AssigneeAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const colors = [
    ['#836efe', '#fff'],
    ['#6703ff', '#fff'],
    ['#8d67ff', '#fff'],
    ['#c856ff', '#fff'],
    ['#a78bfa', '#fff'],
  ]
  const idx = name.charCodeAt(0) % colors.length
  const [bg, fg] = colors[idx]
  const initials = getInitials(name)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
      title={name}
    >
      {initials}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? '#9ca3af'
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GanttChart({
  tasks,
  dependencies,
  viewMode,
  onTaskClick,
  onProgressChange: _onProgressChange,
  onDateChange: _onDateChange,
}: GanttChartProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const sidebarBodyRef = useRef<HTMLDivElement>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'priority'>('default')
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // ── Compute tasks with hierarchy level ──────────────────────────────────────
  const computedTasks = useMemo<ComputedTask[]>(() => {
    const parentIds = new Set(tasks.filter(t => t.parent_id === null || t.parent_id === undefined).map(t => t.id))
    // Mark parents that have children
    const hasChildren = new Set(tasks.filter(t => t.parent_id).map(t => t.parent_id!))

    let sorted = [...tasks]
    if (sortBy === 'name') {
      sorted = sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    } else if (sortBy === 'priority') {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
      sorted = sorted.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
    }

    // Build tree order: parents first, then their children
    const result: ComputedTask[] = []
    const parents = sorted.filter(t => !t.parent_id)
    const childrenMap = new Map<string, ProjectTask[]>()
    sorted.filter(t => t.parent_id).forEach(t => {
      const list = childrenMap.get(t.parent_id!) ?? []
      list.push(t)
      childrenMap.set(t.parent_id!, list)
    })

    for (const p of parents) {
      result.push({
        ...p,
        level: 0,
        isParent: hasChildren.has(p.id),
      })
      const children = childrenMap.get(p.id) ?? []
      for (const c of children) {
        result.push({
          ...c,
          level: 1,
          isParent: false,
        })
      }
    }

    // Also include orphan children not covered
    const coveredIds = new Set(result.map(t => t.id))
    for (const t of sorted) {
      if (!coveredIds.has(t.id)) {
        result.push({ ...t, level: 0, isParent: parentIds.has(t.id) })
      }
    }

    void parentIds // suppress unused

    return result
  }, [tasks, sortBy])

  // ── Compute date range ───────────────────────────────────────────────────────
  const { rangeStart, rangeEnd } = useMemo(() => {
    const datesWithData = tasks
      .flatMap(t => [parseDate(t.start_date), parseDate(t.due_date)])
      .filter(Boolean) as Date[]

    const today = startOfDay(new Date())

    if (datesWithData.length === 0) {
      // No tasks — show a range around today
      return {
        rangeStart: addDays(today, -7),
        rangeEnd: addDays(today, 30),
      }
    }

    const minDate = new Date(Math.min(...datesWithData.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...datesWithData.map(d => d.getTime())))

    // Add padding
    const paddingDays = viewMode === 'day' ? 3 : viewMode === 'week' ? 14 : 30
    return {
      rangeStart: addDays(minDate, -paddingDays),
      rangeEnd: addDays(maxDate, paddingDays),
    }
  }, [tasks, viewMode])

  // ── Build columns ────────────────────────────────────────────────────────────
  const columns = useMemo<Column[]>(() => {
    if (viewMode === 'day') return buildDayColumns(rangeStart, rangeEnd)
    if (viewMode === 'week') return buildWeekColumns(rangeStart, rangeEnd)
    return buildMonthColumns(rangeStart, rangeEnd)
  }, [viewMode, rangeStart, rangeEnd])

  const totalTimelineWidth = useMemo(
    () => columns.reduce((s, c) => s + c.widthPx, 0),
    [columns]
  )

  // ── Position helpers ─────────────────────────────────────────────────────────
  const getXForDate = useCallback(
    (date: Date): number => {
      let x = 0
      for (const col of columns) {
        if (date >= col.startDate && date < col.endDate) {
          const fraction =
            (date.getTime() - col.startDate.getTime()) /
            (col.endDate.getTime() - col.startDate.getTime())
          return x + fraction * col.widthPx
        }
        x += col.widthPx
      }
      // Outside range — clamp
      if (date < columns[0]?.startDate) return 0
      return x
    },
    [columns]
  )

  // ── Today line position ───────────────────────────────────────────────────────
  const todayX = useMemo(() => {
    const now = new Date()
    return getXForDate(now)
  }, [getXForDate])

  // ── Dependency arrows ────────────────────────────────────────────────────────
  const dependencyPaths = useMemo(() => {
    const taskMap = new Map<string, { task: ComputedTask; rowIdx: number }>()
    computedTasks.forEach((t, i) => taskMap.set(t.id, { task: t, rowIdx: i }))

    return dependencies
      .map(dep => {
        const from = taskMap.get(dep.predecessor_id)
        const to = taskMap.get(dep.successor_id)
        if (!from || !to) return null

        const fromTask = from.task
        const toTask = to.task
        const fromEnd = parseDate(fromTask.due_date)
        const toStart = parseDate(toTask.start_date)
        if (!fromEnd || !toStart) return null

        const x1 = getXForDate(fromEnd)
        const y1 = from.rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2
        const x2 = getXForDate(toStart)
        const y2 = to.rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2

        const cx1 = x1 + Math.abs(x2 - x1) * 0.5
        const cx2 = x2 - Math.abs(x2 - x1) * 0.5

        return {
          id: dep.id,
          d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
          isBlocking: dep.is_blocking,
        }
      })
      .filter(Boolean) as Array<{ id: string; d: string; isBlocking: boolean }>
  }, [computedTasks, dependencies, getXForDate])

  // ── Sync vertical scroll between sidebar and timeline body ───────────────────
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarBodyRef.current) {
      sidebarBodyRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }, [])

  const handleSidebarScroll = useCallback(() => {
    if (timelineRef.current && sidebarBodyRef.current) {
      timelineRef.current.scrollTop = sidebarBodyRef.current.scrollTop
    }
  }, [])

  // ── Scroll today into view on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!timelineRef.current) return
    const scrollTarget = Math.max(0, todayX - 200)
    timelineRef.current.scrollLeft = scrollTarget
  }, [todayX, columns])

  // ── Drag-to-resize logic ──────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (taskId: string, edge: 'left' | 'right' | 'move', e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const origStart = parseDate(task.start_date)
      const origEnd = parseDate(task.due_date)
      if (!origStart || !origEnd) return

      const state: DragState = {
        taskId,
        edge,
        startMouseX: e.clientX,
        origStartDate: origStart,
        origEndDate: origEnd,
        currentStartDate: origStart,
        currentEndDate: origEnd,
      }
      dragRef.current = state
      setDrag(state)
      setTooltip(null)
    },
    [tasks]
  )

  useEffect(() => {
    if (!drag) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !timelineRef.current) return
      const d = dragRef.current
      const deltaX = e.clientX - d.startMouseX

      // Convert pixel delta to day delta based on column width
      const colWidth = columns[0]?.widthPx || DAY_WIDTH
      const msPerPx = (columns[0]?.endDate.getTime() - columns[0]?.startDate.getTime()) / colWidth
      const deltaMs = deltaX * msPerPx
      const deltaDays = Math.round(deltaMs / 86_400_000)

      let newStart = d.origStartDate
      let newEnd = d.origEndDate

      if (d.edge === 'left') {
        newStart = addDays(d.origStartDate, deltaDays)
        if (newStart >= newEnd) newStart = addDays(newEnd, -1)
      } else if (d.edge === 'right') {
        newEnd = addDays(d.origEndDate, deltaDays)
        if (newEnd <= newStart) newEnd = addDays(newStart, 1)
      } else {
        // move
        newStart = addDays(d.origStartDate, deltaDays)
        newEnd = addDays(d.origEndDate, deltaDays)
      }

      const updated = { ...d, currentStartDate: newStart, currentEndDate: newEnd }
      dragRef.current = updated
      setDrag(updated)
    }

    const handleMouseUp = () => {
      if (!dragRef.current) return
      const d = dragRef.current
      const startStr = d.currentStartDate.toISOString().split('T')[0]
      const endStr = d.currentEndDate.toISOString().split('T')[0]
      const origStartStr = d.origStartDate.toISOString().split('T')[0]
      const origEndStr = d.origEndDate.toISOString().split('T')[0]

      if (startStr !== origStartStr || endStr !== origEndStr) {
        _onDateChange?.(d.taskId, startStr, endStr)
      }

      dragRef.current = null
      setDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, columns, _onDateChange])

  // ── Empty state check ─────────────────────────────────────────────────────────
  const hasDatedTasks = useMemo(
    () => tasks.some(t => t.start_date && t.due_date),
    [tasks]
  )

  if (!hasDatedTasks) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.25 }}>📅</div>
        <p
          style={{
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--color-text-primary)',
            opacity: 0.6,
            margin: 0,
          }}
        >
          Нет задач с датами для отображения
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          Создайте задачи с датами начала и окончания, чтобы они появились на диаграмме
        </p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-card)',
        userSelect: 'none',
      }}
    >
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          height: HEADER_HEIGHT,
          zIndex: 20,
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            minWidth: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: 'var(--color-bg-card)',
            zIndex: 25,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Задача
          </span>
          {/* Sort buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['name', 'priority'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(prev => (prev === s ? 'default' : s))}
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: sortBy === s ? '1px solid #836efe' : '1px solid var(--color-border)',
                  background: sortBy === s ? 'rgba(131,110,254,0.1)' : 'transparent',
                  color: sortBy === s ? '#836efe' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'name' ? 'А-Я' : 'Приоритет'}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline header — scrolls horizontally */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            id="gantt-header-scroll"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              height: '100%',
              scrollbarWidth: 'none',
            }}
            // Mirror scroll from main timeline
            ref={node => {
              if (!node) return
              // Sync header scroll with timeline body scroll
              const syncScroll = () => {
                const timeline = document.getElementById('gantt-timeline-body')
                if (timeline) node.scrollLeft = timeline.scrollLeft
              }
              node.addEventListener('scroll', () => {
                const timeline = document.getElementById('gantt-timeline-body')
                if (timeline) timeline.scrollLeft = node.scrollLeft
              })
              void syncScroll
            }}
          >
            <div
              style={{
                display: 'flex',
                height: HEADER_HEIGHT,
                width: totalTimelineWidth,
                position: 'relative',
              }}
            >
              {columns.map(col => (
                <div
                  key={col.key}
                  style={{
                    width: col.widthPx,
                    minWidth: col.widthPx,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: '1px solid var(--color-border-subtle)',
                    background: col.isToday
                      ? 'rgba(131,110,254,0.06)'
                      : col.isWeekend
                        ? 'rgba(0,0,0,0.018)'
                        : 'transparent',
                    flexShrink: 0,
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: viewMode === 'day' ? 13 : 12,
                      fontWeight: col.isToday ? 700 : 600,
                      color: col.isToday ? '#836efe' : 'var(--color-text-primary)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: col.widthPx - 8,
                      textAlign: 'center',
                    }}
                  >
                    {col.label}
                  </span>
                  {col.subLabel && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.subLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: Math.max(computedTasks.length * ROW_HEIGHT + 16, 200),
          maxHeight: 600,
        }}
      >
        {/* ── Sidebar body ─────────────────────────────────────────────────── */}
        <div
          ref={sidebarBodyRef}
          onScroll={handleSidebarScroll}
          style={{
            width: SIDEBAR_WIDTH,
            minWidth: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--color-bg-card)',
            zIndex: 15,
            scrollbarWidth: 'thin',
          }}
        >
          {computedTasks.map(task => {
            const isHovered = hoveredRow === task.id
            return (
              <div
                key={task.id}
                onMouseEnter={() => setHoveredRow(task.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => onTaskClick?.(task)}
                style={{
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `0 12px 0 ${task.level === 0 ? 12 : 28}px`,
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: isHovered
                    ? 'var(--color-bg-hover)'
                    : 'transparent',
                  cursor: onTaskClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                  minWidth: 0,
                }}
              >
                {task.isParent && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--color-text-secondary)',
                      marginRight: -2,
                      flexShrink: 0,
                    }}
                  >
                    ▶
                  </span>
                )}
                <PriorityDot priority={task.priority} />
                <span
                  title={task.title}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: task.isParent ? 600 : 400,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {task.title}
                </span>
                {task.assignee && (
                  <AssigneeAvatar name={task.assignee.name} size={22} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Timeline body ─────────────────────────────────────────────────── */}
        <div
          id="gantt-timeline-body"
          ref={timelineRef}
          onScroll={e => {
            handleTimelineScroll()
            // Sync header
            const header = document.getElementById('gantt-header-scroll')
            if (header) header.scrollLeft = (e.target as HTMLDivElement).scrollLeft
          }}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
            scrollbarWidth: 'thin',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: totalTimelineWidth,
              minHeight: computedTasks.length * ROW_HEIGHT,
            }}
          >
            {/* ── Grid background ──────────────────────────────────────────── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              {columns.map(col => (
                <div
                  key={col.key}
                  style={{
                    width: col.widthPx,
                    minWidth: col.widthPx,
                    height: '100%',
                    borderRight: '1px solid var(--color-border-subtle)',
                    background: col.isWeekend
                      ? 'rgba(0,0,0,0.018)'
                      : 'transparent',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* ── Row hover backgrounds ─────────────────────────────────────── */}
            {computedTasks.map((task, i) => (
              <div
                key={`row-bg-${task.id}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * ROW_HEIGHT,
                  width: '100%',
                  height: ROW_HEIGHT,
                  background:
                    hoveredRow === task.id
                      ? 'var(--color-bg-hover)'
                      : 'transparent',
                  transition: 'background 0.1s',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* ── Today line ────────────────────────────────────────────────── */}
            <div
              style={{
                position: 'absolute',
                left: todayX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'rgba(131,110,254,0.7)',
                borderLeft: '2px dashed rgba(131,110,254,0.7)',
                boxShadow: '0 0 8px rgba(131,110,254,0.35)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />

            {/* ── Dependency arrows ─────────────────────────────────────────── */}
            {dependencyPaths.length > 0 && (
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: totalTimelineWidth,
                  height: computedTasks.length * ROW_HEIGHT,
                  pointerEvents: 'none',
                  zIndex: 5,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(150,140,180,0.7)" />
                  </marker>
                  <marker
                    id="arrowhead-blocking"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(239,68,68,0.7)" />
                  </marker>
                </defs>
                {dependencyPaths.map(path => (
                  <path
                    key={path.id}
                    d={path.d}
                    stroke={
                      path.isBlocking
                        ? 'rgba(239,68,68,0.5)'
                        : 'rgba(150,140,180,0.5)'
                    }
                    strokeWidth={1.5}
                    fill="none"
                    markerEnd={
                      path.isBlocking ? 'url(#arrowhead-blocking)' : 'url(#arrowhead)'
                    }
                    strokeDasharray={path.isBlocking ? '0' : '4 2'}
                  />
                ))}
              </svg>
            )}

            {/* ── Task bars ─────────────────────────────────────────────────── */}
            {computedTasks.map((task, rowIdx) => {
              // Use drag state if this task is being dragged
              const isDragging = drag?.taskId === task.id
              const start = isDragging ? drag.currentStartDate : parseDate(task.start_date)
              const end = isDragging ? drag.currentEndDate : parseDate(task.due_date)

              if (!start || !end) return null

              const isMilestone =
                Math.abs(daysBetween(start, end)) <= 1

              const x = getXForDate(start)
              const endX = isMilestone
                ? x + DAY_WIDTH * 0.8
                : getXForDate(end)
              const barWidth = Math.max(endX - x, 8)
              const barTop = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - 28) / 2

              const isCompleted = task.progress >= 100
              const progress = Math.max(0, Math.min(100, task.progress || 0))

              const barBg = isDragging
                ? 'linear-gradient(90deg, rgba(141,103,255,0.85), rgba(200,86,255,0.85))'
                : isCompleted
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, rgba(141,103,255,1), rgba(200,86,255,1))'

              const progressFill = isCompleted
                ? 'rgba(255,255,255,0.25)'
                : 'rgba(255,255,255,0.2)'

              const isHovered = hoveredRow === task.id && !isDragging

              return (
                <div
                  key={`bar-${task.id}`}
                  onMouseEnter={e => {
                    if (drag) return
                    setHoveredRow(task.id)
                    const rect = (e.target as HTMLElement)
                      .closest('[data-gantt-bar]')
                      ?.getBoundingClientRect()
                    const containerRect = timelineRef.current
                      ?.closest('[data-gantt-root]')
                      ?.getBoundingClientRect()
                    if (rect && containerRect) {
                      setTooltip({
                        task,
                        x: rect.left - containerRect.left + rect.width / 2,
                        y: rect.top - containerRect.top - 12,
                      })
                    }
                  }}
                  onMouseLeave={() => {
                    if (drag) return
                    setHoveredRow(null)
                    setTooltip(null)
                  }}
                  onClick={e => {
                    if (drag) return
                    // Don't trigger click if clicking resize handles
                    const target = e.target as HTMLElement
                    if (target.dataset.resizeHandle) return
                    onTaskClick?.(task)
                  }}
                  data-gantt-bar=""
                  style={{
                    position: 'absolute',
                    left: isMilestone ? x - 7 : x + 2,
                    top: barTop,
                    width: isMilestone ? 14 : barWidth - 4,
                    height: 28,
                    borderRadius: isMilestone ? '4px' : 8,
                    background: barBg,
                    boxShadow: isDragging
                      ? '0 6px 24px rgba(131,110,254,0.55), 0 2px 8px rgba(0,0,0,0.2)'
                      : isHovered
                        ? '0 4px 16px rgba(131,110,254,0.45), 0 2px 6px rgba(0,0,0,0.15)'
                        : '0 2px 8px rgba(131,110,254,0.2), 0 1px 3px rgba(0,0,0,0.1)',
                    zIndex: isDragging ? 20 : 8,
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    transform: isMilestone
                      ? 'rotate(45deg)'
                      : isDragging
                        ? 'scaleY(1.1)'
                        : isHovered
                          ? 'scaleY(1.06)'
                          : 'scaleY(1)',
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.15s, box-shadow 0.15s',
                    overflow: 'visible',
                  }}
                >
                  {/* Progress fill */}
                  {!isMilestone && progress > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${progress}%`,
                        background: progressFill,
                        borderRadius: '8px 0 0 8px',
                        transition: isDragging ? 'none' : 'width 0.3s ease',
                        overflow: 'hidden',
                      }}
                    />
                  )}
                  {/* Task label inside bar */}
                  {!isMilestone && barWidth > 50 && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 14,
                        right: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.92)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        pointerEvents: 'none',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {task.title}
                    </span>
                  )}
                  {/* ── Resize handles ──────────────────────────────── */}
                  {!isMilestone && !isDragging && (
                    <>
                      {/* Left resize handle */}
                      <div
                        data-resize-handle="left"
                        onMouseDown={e => handleDragStart(task.id, 'left', e)}
                        style={{
                          position: 'absolute',
                          left: -2,
                          top: 0,
                          width: 10,
                          height: '100%',
                          cursor: 'col-resize',
                          zIndex: 2,
                          borderRadius: '8px 0 0 8px',
                          background: isHovered ? 'rgba(255,255,255,0.25)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      />
                      {/* Right resize handle */}
                      <div
                        data-resize-handle="right"
                        onMouseDown={e => handleDragStart(task.id, 'right', e)}
                        style={{
                          position: 'absolute',
                          right: -2,
                          top: 0,
                          width: 10,
                          height: '100%',
                          cursor: 'col-resize',
                          zIndex: 2,
                          borderRadius: '0 8px 8px 0',
                          background: isHovered ? 'rgba(255,255,255,0.25)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      />
                      {/* Move handle (center area) */}
                      <div
                        onMouseDown={e => handleDragStart(task.id, 'move', e)}
                        style={{
                          position: 'absolute',
                          left: 10,
                          right: 10,
                          top: 0,
                          height: '100%',
                          cursor: 'grab',
                          zIndex: 1,
                        }}
                      />
                    </>
                  )}
                  {/* Date preview while dragging */}
                  {isDragging && !isMilestone && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#836efe',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        pointerEvents: 'none',
                        zIndex: 30,
                      }}
                    >
                      {drag.currentStartDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      {' — '}
                      {drag.currentEndDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tooltip ────────────────────────────────────────────────────────── */}
      {tooltip && (
        <TaskTooltip tooltip={tooltip} />
      )}
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function TaskTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { task, x, y } = tooltip
  const start = parseDate(task.start_date)
  const end = parseDate(task.due_date)

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '10px 14px',
          minWidth: 200,
          maxWidth: 280,
        }}
      >
        <p
          style={{
            margin: '0 0 6px',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--color-text-primary)',
            lineHeight: 1.3,
          }}
        >
          {task.title}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {start && end && (
            <span
              style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}
            >
              {formatDate(start)} — {formatDate(end)}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Прогресс:
            </span>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'var(--color-bg-hover)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${task.progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #836efe, #c856ff)',
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#836efe',
              }}
            >
              {task.progress}%
            </span>
          </div>
          {task.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <AssigneeAvatar name={task.assignee.name} size={18} />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {task.assignee.name}
              </span>
            </div>
          )}
        </div>
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 10,
            height: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              transform: 'rotate(45deg)',
              transformOrigin: 'center',
              marginTop: -5,
              marginLeft: 0,
            }}
          />
        </div>
      </div>
    </div>
  )
}
