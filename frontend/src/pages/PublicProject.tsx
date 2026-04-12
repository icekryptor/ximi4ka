import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  publicProjectApi,
  PublicProject,
  PublicTask,
  PublicChecklistItem,
  PublicComment,
  PublicMember,
} from '../api/publicProject'

// ── Constants ────────────────────────────────────────────────────────────────

const columns = [
  { key: 'backlog', label: 'Бэклог' },
  { key: 'todo', label: 'К выполнению' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'review', label: 'На ревью' },
  { key: 'done', label: 'Готово' },
]

const priorityIcon: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }
const priorityLabel: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' }

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: '#9ca3af' },
  active: { label: 'Активный', color: '#22c55e' },
  on_hold: { label: 'На паузе', color: '#f59e0b' },
  completed: { label: 'Завершён', color: '#3b82f6' },
  cancelled: { label: 'Отменён', color: '#ef4444' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeToken(token: string): { projectId: string; employeeId: string; scope?: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { projectId: payload.projectId, employeeId: payload.employeeId, scope: payload.scope }
  } catch {
    return null
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcTaskProgress(task: PublicTask): number {
  if (task.checklist && task.checklist.length > 0) {
    const done = task.checklist.filter(i => i.is_checked).length
    return Math.round((done / task.checklist.length) * 100)
  }
  return task.progress ?? 0
}

function calcProjectProgress(tasks: PublicTask[]): number {
  if (!tasks.length) return 0
  const sum = tasks.reduce((acc, t) => acc + calcTaskProgress(t), 0)
  return Math.round(sum / tasks.length)
}

function fmtBudget(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDone: () => void
}

function Toast({ message, type, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      style={{ zIndex: 9999 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-sm font-medium shadow-lg transition-all
        ${type === 'success' ? 'bg-[#836efe]' : 'bg-[#ef4444]'}`}
    >
      {message}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PublicProjectPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const decoded = token ? decodeToken(token) : null
  const employeeId = decoded?.employeeId ?? null
  const isResponsible = decoded?.scope === 'responsible'

  // ── State ────────────────────────────────────────────────────────────────
  const [project, setProject] = useState<PublicProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Task detail panel
  const [selectedTask, setSelectedTask] = useState<PublicTask | null>(null)
  const [comments, setComments] = useState<PublicComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  // Task edit form (inside detail panel)
  const [editColumn, setEditColumn] = useState('')
  const [editProgress, setEditProgress] = useState(0)
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)

  // Checklist optimistic state
  const [checklistState, setChecklistState] = useState<PublicChecklistItem[]>([])

  // Add task modal (responsible only)
  const [showAddTask, setShowAddTask] = useState(false)
  const [addTaskForm, setAddTaskForm] = useState({
    title: '', description: '', assignee_id: '', due_date: '', priority: 'medium',
  })
  const [addTaskSaving, setAddTaskSaving] = useState(false)

  // Project edit (responsible only)
  const [editingProject, setEditingProject] = useState(false)
  const [projectForm, setProjectForm] = useState({
    status: '', budget: 0, start_date: '', end_date: '',
  })
  const [projectSaving, setProjectSaving] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  const projectId = routeId ?? decoded?.projectId ?? ''

  // ── Load project ─────────────────────────────────────────────────────────
  const loadProject = useCallback(() => {
    if (!projectId || !token) return
    setLoading(true)
    publicProjectApi.getProject(projectId, token)
      .then(data => {
        setProject(data)
        setError(null)
      })
      .catch(err => {
        const msg = err?.response?.data?.error ?? 'Ошибка загрузки проекта'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [projectId, token])

  useEffect(() => { loadProject() }, [loadProject])

  // ── Open task detail ──────────────────────────────────────────────────────
  const openTask = useCallback((task: PublicTask) => {
    setSelectedTask(task)
    setEditColumn(task.column)
    setEditProgress(calcTaskProgress(task))
    setEditAssigneeId(task.assignee_id ?? '')
    setChecklistState(task.checklist ?? [])
    setComments([])
    setNewComment('')

    setCommentsLoading(true)
    publicProjectApi.getComments(projectId, task.id, token)
      .then(setComments)
      .catch(() => {})
      .finally(() => setCommentsLoading(false))
  }, [projectId, token])

  const closeTask = () => setSelectedTask(null)

  // ── Derived values ────────────────────────────────────────────────────────
  const memberRecord = project?.members.find(m => m.employee_id === employeeId)
  const myName = memberRecord?.employee?.name ?? null

  const canEditTask = (task: PublicTask): boolean => {
    if (!token) return false
    if (isResponsible) return true
    return task.assignee_id === employeeId
  }

  // ── Task column / progress save ───────────────────────────────────────────
  const saveTaskField = async (taskId: string, data: Partial<PublicTask>) => {
    setTaskSaving(true)
    try {
      const updated = await publicProjectApi.updateTask(projectId, taskId, token, data)
      // Update in project.tasks optimistically
      setProject(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...updated } : t),
      } : prev)
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, ...updated } : prev)
      }
      showToast('Сохранено')
    } catch {
      showToast('Ошибка сохранения', 'error')
    } finally {
      setTaskSaving(false)
    }
  }

  // ── Checklist toggle ──────────────────────────────────────────────────────
  const toggleChecklist = async (item: PublicChecklistItem) => {
    if (!selectedTask || !canEditTask(selectedTask)) return
    const newChecked = !item.is_checked
    // Optimistic update
    const updated = checklistState.map(i => i.id === item.id ? { ...i, is_checked: newChecked } : i)
    setChecklistState(updated)
    const newProgress = updated.length
      ? Math.round(updated.filter(i => i.is_checked).length / updated.length * 100)
      : editProgress
    setEditProgress(newProgress)

    try {
      await publicProjectApi.updateChecklistItem(projectId, selectedTask.id, item.id, token, { is_checked: newChecked })
      setProject(prev => prev ? {
        ...prev,
        tasks: prev.tasks.map(t => t.id === selectedTask.id
          ? { ...t, checklist: updated, progress: newProgress }
          : t),
      } : prev)
    } catch {
      // Revert on error
      setChecklistState(checklistState)
      setEditProgress(calcTaskProgress(selectedTask))
      showToast('Ошибка обновления', 'error')
    }
  }

  // ── Add comment ───────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return
    setCommentSaving(true)
    try {
      const comment = await publicProjectApi.addComment(projectId, selectedTask.id, token, { text: newComment.trim() })
      setComments(prev => [...prev, comment])
      setNewComment('')
      showToast('Комментарий добавлен')
    } catch {
      showToast('Ошибка отправки комментария', 'error')
    } finally {
      setCommentSaving(false)
    }
  }

  // ── Add task (responsible) ────────────────────────────────────────────────
  const handleAddTask = async () => {
    if (!addTaskForm.title.trim()) return
    setAddTaskSaving(true)
    try {
      const task = await publicProjectApi.addTask(projectId, token, {
        title: addTaskForm.title,
        description: addTaskForm.description || undefined,
        assignee_id: addTaskForm.assignee_id || undefined,
        due_date: addTaskForm.due_date || undefined,
        priority: addTaskForm.priority,
      })
      setProject(prev => prev ? { ...prev, tasks: [...prev.tasks, task] } : prev)
      setShowAddTask(false)
      setAddTaskForm({ title: '', description: '', assignee_id: '', due_date: '', priority: 'medium' })
      showToast('Задача добавлена')
    } catch {
      showToast('Ошибка создания задачи', 'error')
    } finally {
      setAddTaskSaving(false)
    }
  }

  // ── Save project settings ─────────────────────────────────────────────────
  const saveProjectSettings = async () => {
    setProjectSaving(true)
    try {
      const updated = await publicProjectApi.updateProject(projectId, token, {
        status: projectForm.status,
        budget: projectForm.budget,
        start_date: projectForm.start_date || undefined,
        end_date: projectForm.end_date || undefined,
      } as Partial<PublicProject>)
      setProject(prev => prev ? { ...prev, ...updated } : prev)
      setEditingProject(false)
      showToast('Проект обновлён')
    } catch {
      showToast('Ошибка сохранения проекта', 'error')
    } finally {
      setProjectSaving(false)
    }
  }

  // ── No-token state ────────────────────────────────────────────────────────
  if (!token || !decoded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#eeebf3', fontFamily: 'Arial, sans-serif' }}>
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-xl font-bold mb-3" style={{ color: '#1c1528' }}>Доступ закрыт</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#524667' }}>
            Для доступа к проекту запросите персональную ссылку в Telegram-чате проекта, используя команду{' '}
            <span className="font-mono font-bold" style={{ color: '#836efe' }}>/mylink</span>
          </p>
        </div>
      </div>
    )
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#eeebf3', fontFamily: 'Arial, sans-serif' }}>
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-3"
            style={{ borderColor: '#836efe', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#524667' }}>Загрузка проекта...</p>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#eeebf3', fontFamily: 'Arial, sans-serif' }}>
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-3" style={{ color: '#1c1528' }}>Нет доступа</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#524667' }}>
            {error ?? 'Не удалось загрузить проект. Попробуйте обновить страницу.'}
          </p>
        </div>
      </div>
    )
  }

  const projectProgress = calcProjectProgress(project.tasks)
  const statusInfo = statusLabels[project.status] ?? { label: project.status, color: '#9ca3af' }

  const getMemberName = (authorId: string) => {
    const m = project.members.find(m => m.employee_id === authorId)
    return m?.employee?.name ?? 'Неизвестно'
  }

  return (
    <div className="min-h-screen" style={{ background: '#eeebf3', fontFamily: 'Arial, sans-serif' }}>

      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e8e5ef' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold truncate" style={{ color: '#1c1528' }}>{project.name}</span>
          <span
            className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${statusInfo.color}20`, color: statusInfo.color }}
          >
            {statusInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {myName && (
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold" style={{ color: '#1c1528' }}>{myName}</span>
              <span className="text-xs" style={{ color: '#836efe' }}>
                {isResponsible ? 'Ответственный' : 'Участник'}
              </span>
            </div>
          )}
          <span className="text-lg" title="Telegram">🤖</span>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto">

        {/* ── Project Info Cards ────────────────────────────────────────── */}
        {!editingProject ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Progress */}
            <div className="bg-white rounded-2xl p-4 col-span-2 sm:col-span-1">
              <p className="text-xs mb-1" style={{ color: '#524667' }}>Прогресс</p>
              <p className="text-2xl font-bold mb-2" style={{ color: '#836efe' }}>{projectProgress}%</p>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#eeebf3' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${projectProgress}%`, background: 'linear-gradient(90deg, #8d67ff, #c856ff)' }}
                />
              </div>
            </div>
            {/* Budget */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-xs mb-1" style={{ color: '#524667' }}>Бюджет</p>
              <p className="text-sm font-bold" style={{ color: '#1c1528' }}>{fmtBudget(project.budget)}</p>
            </div>
            {/* Dates */}
            <div className="bg-white rounded-2xl p-4">
              <p className="text-xs mb-1" style={{ color: '#524667' }}>Начало</p>
              <p className="text-sm font-semibold" style={{ color: '#1c1528' }}>{formatDate(project.start_date)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <p className="text-xs mb-1" style={{ color: '#524667' }}>Дедлайн</p>
              <p className="text-sm font-semibold" style={{ color: '#1c1528' }}>{formatDate(project.end_date)}</p>
            </div>
            {/* Edit button for responsible */}
            {isResponsible && (
              <div className="col-span-2 sm:col-span-4 flex justify-end">
                <button
                  onClick={() => {
                    setProjectForm({
                      status: project.status,
                      budget: project.budget ?? 0,
                      start_date: project.start_date?.substring(0, 10) ?? '',
                      end_date: project.end_date?.substring(0, 10) ?? '',
                    })
                    setEditingProject(true)
                  }}
                  className="text-xs px-4 py-2 rounded-xl font-medium transition-colors"
                  style={{ background: '#eeebf3', color: '#836efe' }}
                >
                  Редактировать проект
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Edit project form */
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold" style={{ color: '#1c1528' }}>Редактирование проекта</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Статус</label>
                <select
                  value={projectForm.status}
                  onChange={e => setProjectForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                >
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Бюджет (₽)</label>
                <input
                  type="number"
                  value={projectForm.budget}
                  onChange={e => setProjectForm(f => ({ ...f, budget: Number(e.target.value) }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Дата начала</label>
                <input
                  type="date"
                  value={projectForm.start_date}
                  onChange={e => setProjectForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Дедлайн</label>
                <input
                  type="date"
                  value={projectForm.end_date}
                  onChange={e => setProjectForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveProjectSettings}
                disabled={projectSaving}
                className="flex-1 text-sm py-2 rounded-xl font-medium text-white transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
              >
                {projectSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditingProject(false)}
                className="flex-1 text-sm py-2 rounded-xl font-medium"
                style={{ background: '#eeebf3', color: '#524667' }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* ── Kanban Board ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: '#1c1528' }}>
              Доска задач
              <span className="ml-2 text-xs font-normal" style={{ color: '#524667' }}>
                ({project.tasks.length} задач)
              </span>
            </h2>
            {isResponsible && (
              <button
                onClick={() => setShowAddTask(true)}
                className="text-xs px-4 py-2 rounded-xl font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
              >
                + Задача
              </button>
            )}
          </div>

          {/* Horizontal scroll container */}
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollSnapType: 'x mandatory' }}>
            {columns.map(col => {
              const colTasks = project.tasks.filter(t => t.column === col.key)
              return (
                <div
                  key={col.key}
                  className="shrink-0 w-72 rounded-2xl p-3 space-y-2"
                  style={{ background: '#ffffff', border: '1px solid #e8e5ef', scrollSnapAlign: 'start' }}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: '#1c1528' }}>{col.label}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#eeebf3', color: '#836efe' }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: '#9ca3af' }}>Пусто</p>
                  )}
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit={canEditTask(task)}
                      onClick={() => openTask(task)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Members (responsible sees list) ───────────────────────────── */}
        {isResponsible && project.members.length > 0 && (
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: '#1c1528' }}>Участники</h3>
            <div className="flex flex-wrap gap-2">
              {project.members.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: '#eeebf3' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
                  >
                    {m.employee?.name?.charAt(0) ?? '?'}
                  </div>
                  <span style={{ color: '#1c1528' }}>{m.employee?.name}</span>
                  {m.role && (
                    <span style={{ color: '#836efe' }}>{m.role}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Task Modal ─────────────────────────────────────────────────── */}
      {showAddTask && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(28,21,40,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddTask(false) }}
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold" style={{ color: '#1c1528' }}>Новая задача</h3>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Название *</label>
              <input
                autoFocus
                type="text"
                placeholder="Введите название задачи"
                value={addTaskForm.title}
                onChange={e => setAddTaskForm(f => ({ ...f, title: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Описание</label>
              <textarea
                rows={3}
                placeholder="Опишите задачу..."
                value={addTaskForm.description}
                onChange={e => setAddTaskForm(f => ({ ...f, description: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none resize-none"
                style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Приоритет</label>
                <select
                  value={addTaskForm.priority}
                  onChange={e => setAddTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                >
                  {Object.entries(priorityLabel).map(([k, v]) => (
                    <option key={k} value={k}>{priorityIcon[k]} {v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Дедлайн</label>
                <input
                  type="date"
                  value={addTaskForm.due_date}
                  onChange={e => setAddTaskForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#524667' }}>Исполнитель</label>
              <select
                value={addTaskForm.assignee_id}
                onChange={e => setAddTaskForm(f => ({ ...f, assignee_id: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
                style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
              >
                <option value="">— Не назначен —</option>
                {project.members.map(m => (
                  <option key={m.employee_id} value={m.employee_id}>{m.employee?.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddTask}
                disabled={addTaskSaving || !addTaskForm.title.trim()}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium text-white transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
              >
                {addTaskSaving ? 'Создание...' : 'Создать задачу'}
              </button>
              <button
                onClick={() => setShowAddTask(false)}
                className="flex-1 text-sm py-2.5 rounded-xl font-medium"
                style={{ background: '#eeebf3', color: '#524667' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Detail Panel ─────────────────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          project={project}
          canEdit={canEditTask(selectedTask)}
          isResponsible={isResponsible}
          employeeId={employeeId ?? ''}
          editColumn={editColumn}
          editProgress={editProgress}
          editAssigneeId={editAssigneeId}
          checklistState={checklistState}
          comments={comments}
          commentsLoading={commentsLoading}
          newComment={newComment}
          commentSaving={commentSaving}
          taskSaving={taskSaving}
          getMemberName={getMemberName}
          onColumnChange={col => {
            setEditColumn(col)
            saveTaskField(selectedTask.id, { column: col } as Partial<PublicTask>)
          }}
          onProgressChange={val => setEditProgress(val)}
          onProgressCommit={val => saveTaskField(selectedTask.id, { progress: val } as Partial<PublicTask>)}
          onAssigneeChange={id => {
            setEditAssigneeId(id)
            saveTaskField(selectedTask.id, { assignee_id: id } as Partial<PublicTask>)
          }}
          onChecklistToggle={toggleChecklist}
          onNewCommentChange={setNewComment}
          onAddComment={handleAddComment}
          onClose={closeTask}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  )
}

// ── TaskCard Component ────────────────────────────────────────────────────────

interface TaskCardProps {
  task: PublicTask
  canEdit: boolean
  onClick: () => void
}

function TaskCard({ task, canEdit, onClick }: TaskCardProps) {
  const progress = calcTaskProgress(task)
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 space-y-2 transition-all hover:shadow-md active:scale-95"
      style={{ background: canEdit ? '#faf9ff' : '#f9f9f9', border: `1px solid ${canEdit ? '#e0d8ff' : '#e8e5ef'}` }}
    >
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <span className="text-sm mt-0.5">{priorityIcon[task.priority] ?? '⚪'}</span>
        <span className="text-xs font-semibold leading-snug flex-1" style={{ color: '#1c1528' }}>
          {task.title}
        </span>
      </div>
      {/* Assignee + due date */}
      <div className="flex items-center justify-between gap-2">
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)', fontSize: '10px' }}
            >
              {task.assignee.name.charAt(0)}
            </div>
            <span className="text-xs truncate max-w-[80px]" style={{ color: '#524667' }}>
              {task.assignee.name.split(' ')[0]}
            </span>
          </div>
        ) : (
          <span className="text-xs" style={{ color: '#9ca3af' }}>Не назначен</span>
        )}
        {task.due_date && (
          <span className="text-xs shrink-0" style={{ color: '#9ca3af' }}>
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
      {/* Progress bar */}
      {(task.checklist?.length > 0 || task.progress > 0) && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: '#9ca3af' }}>
              {task.checklist?.length > 0
                ? `${task.checklist.filter(i => i.is_checked).length}/${task.checklist.length}`
                : `${progress}%`}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#eeebf3' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #8d67ff, #c856ff)',
              }}
            />
          </div>
        </div>
      )}
    </button>
  )
}

// ── TaskDetailPanel Component ─────────────────────────────────────────────────

interface TaskDetailPanelProps {
  task: PublicTask
  project: PublicProject
  canEdit: boolean
  isResponsible: boolean
  employeeId: string
  editColumn: string
  editProgress: number
  editAssigneeId: string
  checklistState: PublicChecklistItem[]
  comments: PublicComment[]
  commentsLoading: boolean
  newComment: string
  commentSaving: boolean
  taskSaving: boolean
  getMemberName: (id: string) => string
  onColumnChange: (col: string) => void
  onProgressChange: (val: number) => void
  onProgressCommit: (val: number) => void
  onAssigneeChange: (id: string) => void
  onChecklistToggle: (item: PublicChecklistItem) => void
  onNewCommentChange: (val: string) => void
  onAddComment: () => void
  onClose: () => void
}

function TaskDetailPanel({
  task, project, canEdit, isResponsible,
  editColumn, editProgress, editAssigneeId,
  checklistState, comments, commentsLoading,
  newComment, commentSaving, taskSaving,
  getMemberName,
  onColumnChange, onProgressChange, onProgressCommit,
  onAssigneeChange, onChecklistToggle,
  onNewCommentChange, onAddComment, onClose,
}: TaskDetailPanelProps) {
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(28,21,40,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3"
          style={{ borderBottom: '1px solid #e8e5ef' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span>{priorityIcon[task.priority] ?? '⚪'}</span>
              <span className="text-xs font-semibold" style={{ color: '#836efe' }}>
                {priorityLabel[task.priority] ?? task.priority}
              </span>
            </div>
            <h2 className="text-base font-bold leading-snug" style={{ color: '#1c1528' }}>{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ background: '#eeebf3', color: '#524667' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#524667' }}>Описание</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1c1528' }}>
                {task.description}
              </p>
            </div>
          )}

          {/* Column selector */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#524667' }}>Колонка</p>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <button
                    key={col.key}
                    disabled={taskSaving}
                    onClick={() => onColumnChange(col.key)}
                    className="text-xs px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-60"
                    style={editColumn === col.key
                      ? { background: 'linear-gradient(135deg, #8d67ff, #c856ff)', color: '#fff' }
                      : { background: '#eeebf3', color: '#524667' }
                    }
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            ) : (
              <span
                className="text-xs px-3 py-1.5 rounded-xl font-medium inline-block"
                style={{ background: '#eeebf3', color: '#524667' }}
              >
                {columns.find(c => c.key === editColumn)?.label ?? editColumn}
              </span>
            )}
          </div>

          {/* Progress (only for tasks without checklist) */}
          {checklistState.length === 0 && (
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: '#524667' }}>Прогресс</p>
                <span className="text-xs font-bold" style={{ color: '#836efe' }}>{editProgress}%</span>
              </div>
              {canEdit ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editProgress}
                  onChange={e => onProgressChange(Number(e.target.value))}
                  onMouseUp={e => onProgressCommit(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={e => onProgressCommit(Number((e.target as HTMLInputElement).value))}
                  disabled={taskSaving}
                  className="w-full accent-[#836efe] disabled:opacity-60"
                />
              ) : (
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#eeebf3' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${editProgress}%`, background: 'linear-gradient(90deg, #8d67ff, #c856ff)' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Assignee */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#524667' }}>Исполнитель</p>
            {isResponsible ? (
              <select
                value={editAssigneeId}
                onChange={e => onAssigneeChange(e.target.value)}
                disabled={taskSaving}
                className="w-full text-sm px-3 py-2 rounded-xl border outline-none disabled:opacity-60"
                style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
              >
                <option value="">— Не назначен —</option>
                {project.members.map(m => (
                  <option key={m.employee_id} value={m.employee_id}>{m.employee?.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                {task.assignee ? (
                  <>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
                    >
                      {task.assignee.name.charAt(0)}
                    </div>
                    <span className="text-sm" style={{ color: '#1c1528' }}>{task.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-sm" style={{ color: '#9ca3af' }}>Не назначен</span>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          {(task.start_date || task.due_date) && (
            <div className="flex gap-4">
              {task.start_date && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#524667' }}>Начало</p>
                  <p className="text-sm font-semibold" style={{ color: '#1c1528' }}>{formatDate(task.start_date)}</p>
                </div>
              )}
              {task.due_date && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#524667' }}>Дедлайн</p>
                  <p className="text-sm font-semibold" style={{ color: '#1c1528' }}>{formatDate(task.due_date)}</p>
                </div>
              )}
            </div>
          )}

          {/* Checklist */}
          {checklistState.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: '#524667' }}>
                  Чеклист
                </p>
                <span className="text-xs font-bold" style={{ color: '#836efe' }}>
                  {checklistState.filter(i => i.is_checked).length}/{checklistState.length}
                </span>
              </div>
              {/* Checklist progress */}
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#eeebf3' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(checklistState.filter(i => i.is_checked).length / checklistState.length * 100)}%`,
                    background: 'linear-gradient(90deg, #8d67ff, #c856ff)',
                  }}
                />
              </div>
              <ul className="space-y-2">
                {checklistState.map(item => (
                  <li key={item.id} className="flex items-start gap-3">
                    <button
                      onClick={() => onChecklistToggle(item)}
                      disabled={!canEdit}
                      className="shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors disabled:opacity-50"
                      style={item.is_checked
                        ? { background: '#836efe', borderColor: '#836efe' }
                        : { background: '#fff', borderColor: '#e8e5ef' }
                      }
                    >
                      {item.is_checked && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span
                      className="text-sm leading-tight"
                      style={{
                        color: item.is_checked ? '#9ca3af' : '#1c1528',
                        textDecoration: item.is_checked ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Read-only notice for members viewing others' tasks */}
          {!canEdit && (
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{ background: '#eeebf3', color: '#524667' }}
            >
              Эта задача назначена другому участнику. Редактирование недоступно.
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: '#524667' }}>Комментарии</p>
            {commentsLoading ? (
              <p className="text-xs text-center py-2" style={{ color: '#9ca3af' }}>Загрузка...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: '#9ca3af' }}>Нет комментариев</p>
            ) : (
              <ul className="space-y-3 mb-4">
                {comments.map(c => (
                  <li key={c.id} className="flex gap-2">
                    <div
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)' }}
                    >
                      {getMemberName(c.author_id).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: '#1c1528' }}>
                          {getMemberName(c.author_id)}
                        </span>
                        <span className="text-xs" style={{ color: '#9ca3af' }}>
                          {formatDateTime(c.created_at)}
                        </span>
                      </div>
                      <p
                        className="text-sm leading-relaxed break-words whitespace-pre-wrap"
                        style={{ color: '#524667' }}
                      >
                        {c.text}
                      </p>
                      {c.attachment_url && (
                        <a
                          href={c.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-1 inline-block"
                          style={{ color: '#836efe' }}
                        >
                          {c.attachment_name ?? 'Вложение'}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
                <div ref={commentsEndRef} />
              </ul>
            )}

            {/* Add comment form */}
            <div className="flex gap-2">
                <textarea
                  rows={2}
                  placeholder="Написать комментарий..."
                  value={newComment}
                  onChange={e => onNewCommentChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onAddComment()
                  }}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ borderColor: '#e8e5ef', color: '#1c1528' }}
                />
                <button
                  onClick={onAddComment}
                  disabled={commentSaving || !newComment.trim()}
                  className="shrink-0 px-4 rounded-xl text-sm font-medium text-white self-end disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #8d67ff, #c856ff)', paddingTop: '8px', paddingBottom: '8px' }}
                >
                  {commentSaving ? '...' : 'OK'}
                </button>
              </div>
          </div>

          {/* Bottom padding for safe area */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}
