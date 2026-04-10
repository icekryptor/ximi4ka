import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, ProjectDetail as ProjDetail, ProjectTask, ChecklistItem, TaskCommentItem } from '../api/projects'
import { employeesApi, Employee } from '../api/employees'
import GanttChart from '../components/GanttChart'
import Portal from '../components/Portal'

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  active: { label: 'Активный', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  on_hold: { label: 'На паузе', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Завершён', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  cancelled: { label: 'Отменён', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', start_date: '', due_date: '', assignee_id: '', parent_id: '' })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [editForm, setEditForm] = useState({ title: '', start_date: '', due_date: '', assignee_id: '', progress: 0, priority: 'medium', description: '' })
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [comments, setComments] = useState<TaskCommentItem[]>([])
  const [newComment, setNewComment] = useState('')
  const [newCommentLink, setNewCommentLink] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  const load = () => {
    if (!id) return
    projectsApi.getOne(id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { employeesApi.getAll().then(setEmployees).catch(console.error) }, [])

  const handleAddTask = async () => {
    if (!id || !taskForm.title) return
    try {
      await projectsApi.addTask(id, {
        title: taskForm.title,
        start_date: taskForm.start_date || undefined,
        due_date: taskForm.due_date || undefined,
        assignee_id: taskForm.assignee_id || undefined,
        parent_id: taskForm.parent_id || undefined,
      })
      setShowAddTask(false)
      setTaskForm({ title: '', start_date: '', due_date: '', assignee_id: '', parent_id: '' })
      load()
    } catch (err) { console.error(err) }
  }

  const handleProgressChange = async (taskId: string, progress: number) => {
    if (!id) return
    try {
      await projectsApi.updateTask(id, taskId, { progress })
      load()
    } catch (err) { console.error(err) }
  }

  const handleDateChange = async (taskId: string, startDate: string, endDate: string) => {
    if (!id) return
    try {
      await projectsApi.updateTask(id, taskId, {
        start_date: startDate,
        due_date: endDate,
      })
      load()
    } catch (err) { console.error(err) }
  }

  const handleTaskClick = (task: ProjectTask) => {
    setEditingTask(task)
    setEditForm({
      title: task.title,
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      assignee_id: task.assignee_id || '',
      progress: task.progress || 0,
      priority: task.priority || 'medium',
      description: task.description || '',
    })
    setChecklist(task.checklist || [])
    setNewChecklistTitle('')
    setComments([])
    setNewComment('')
    setNewCommentLink('')
    setShowLinkInput(false)
    if (id) {
      projectsApi.getComments(id, task.id).then(setComments).catch(console.error)
    }
  }

  const handleAddChecklistItem = async () => {
    if (!id || !editingTask || !newChecklistTitle.trim()) return
    try {
      await projectsApi.addChecklistItem(id, editingTask.id, newChecklistTitle.trim())
      setNewChecklistTitle('')
      const fresh = await projectsApi.getOne(id)
      setProject(fresh)
      const refreshed = fresh.tasks.find(t => t.id === editingTask.id)
      if (refreshed) {
        setEditingTask(refreshed)
        setChecklist(refreshed.checklist || [])
      }
    } catch (err) { console.error(err) }
  }

  const handleToggleChecklistItem = async (item: ChecklistItem) => {
    if (!id || !editingTask) return
    try {
      await projectsApi.updateChecklistItem(id, editingTask.id, item.id, { is_checked: !item.is_checked })
      const fresh = await projectsApi.getOne(id)
      setProject(fresh)
      const refreshed = fresh.tasks.find(t => t.id === editingTask.id)
      if (refreshed) {
        setEditingTask(refreshed)
        setChecklist(refreshed.checklist || [])
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!id || !editingTask) return
    try {
      await projectsApi.deleteChecklistItem(id, editingTask.id, itemId)
      const fresh = await projectsApi.getOne(id)
      setProject(fresh)
      const refreshed = fresh.tasks.find(t => t.id === editingTask.id)
      if (refreshed) {
        setEditingTask(refreshed)
        setChecklist(refreshed.checklist || [])
      }
    } catch (err) { console.error(err) }
  }

  const handleAddComment = async () => {
    if (!id || !editingTask || !newComment.trim()) return
    try {
      const payload: { text: string; attachment_url?: string; attachment_name?: string } = {
        text: newComment.trim(),
      }
      if (newCommentLink.trim()) {
        payload.attachment_url = newCommentLink.trim()
        try {
          payload.attachment_name = new URL(newCommentLink.trim()).hostname
        } catch {
          payload.attachment_name = newCommentLink.trim()
        }
      }
      await projectsApi.addComment(id, editingTask.id, payload)
      setNewComment('')
      setNewCommentLink('')
      setShowLinkInput(false)
      const updated = await projectsApi.getComments(id, editingTask.id)
      setComments(updated)
    } catch (err) { console.error(err) }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !editingTask) return
    try {
      await projectsApi.deleteComment(id, editingTask.id, commentId)
      const updated = await projectsApi.getComments(id, editingTask.id)
      setComments(updated)
    } catch (err) { console.error(err) }
  }

  const formatCommentDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getInitials = (authorId: string) => {
    return authorId.slice(0, 2).toUpperCase()
  }

  const handleEditSave = async () => {
    if (!id || !editingTask) return
    try {
      await projectsApi.updateTask(id, editingTask.id, {
        title: editForm.title,
        start_date: editForm.start_date || undefined,
        due_date: editForm.due_date || undefined,
        assignee_id: editForm.assignee_id || undefined,
        progress: editForm.progress,
        priority: editForm.priority,
        description: editForm.description || undefined,
      })
      setEditingTask(null)
      load()
    } catch (err) { console.error(err) }
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const st = statusLabels[project.status] || statusLabels.draft
  const avgProgress = project.tasks.length > 0
    ? Math.round(project.tasks.reduce((s, t) => s + (t.progress || 0), 0) / project.tasks.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/planning/projects')} className="text-brand-text-secondary hover:text-brand-text transition-colors">
          ← Назад
        </button>
        <h1 className="text-2xl font-bold text-brand-text">{project.name}</h1>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.className}`}>{st.label}</span>
        {project.responsible && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex-shrink-0">
              {project.responsible.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </span>
            {project.responsible.name}
          </span>
        )}
        <button
          onClick={() => projectsApi.exportProject(id!)}
          className="ml-auto px-4 py-2 border border-brand-border text-brand-text rounded-xl text-sm font-medium hover:bg-brand-surface transition-colors"
        >
          ⬇ JSON
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <div className="text-xs text-brand-text-secondary mb-1">Прогресс</div>
          <div className="text-xl font-bold text-brand-text">{avgProgress}%</div>
          <div className="w-full bg-card rounded-full h-1.5 mt-2">
            <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <div className="text-xs text-brand-text-secondary mb-1">Бюджет</div>
          <div className="text-xl font-bold text-brand-text">{Number(project.budget).toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <div className="text-xs text-brand-text-secondary mb-1">Задач</div>
          <div className="text-xl font-bold text-brand-text">{project.tasks.length}</div>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <div className="text-xs text-brand-text-secondary mb-1">Дедлайн</div>
          <div className="text-xl font-bold text-brand-text">
            {project.end_date ? new Date(project.end_date).toLocaleDateString('ru-RU') : '—'}
          </div>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <div className="text-xs text-brand-text-secondary mb-1">Ответственный</div>
          <div className="text-xl font-bold text-brand-text truncate">
            {project.responsible?.name || '—'}
          </div>
        </div>
      </div>

      {/* Gantt toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-card p-1 rounded-xl border border-brand-border">
          {([
            { mode: 'day' as const, label: 'День' },
            { mode: 'week' as const, label: 'Неделя' },
            { mode: 'month' as const, label: 'Месяц' },
          ]).map(v => (
            <button
              key={v.label}
              onClick={() => setViewMode(v.mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === v.mode
                  ? 'bg-brand-surface text-brand-text shadow-sm'
                  : 'text-brand-text-secondary hover:text-brand-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          + Задача
        </button>
      </div>

      {/* Add task form */}
      {showAddTask && (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-brand-text">Новая задача</h2>
          <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Название задачи" className="w-full px-4 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-brand-text-secondary">Начало</label>
              <input value={taskForm.start_date} onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })} type="date" className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
            </div>
            <div>
              <label className="text-xs text-brand-text-secondary">Окончание</label>
              <input value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} type="date" className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
            </div>
          </div>
          <select value={taskForm.assignee_id} onChange={e => setTaskForm({ ...taskForm, assignee_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text">
            <option value="">Исполнитель...</option>
            {employees.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {project.tasks.length > 0 && (
            <select value={taskForm.parent_id} onChange={e => setTaskForm({ ...taskForm, parent_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text">
              <option value="">Без родительской задачи</option>
              {project.tasks.filter(t => !t.parent_id).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-brand-text-secondary hover:text-brand-text transition-colors">Отмена</button>
            <button onClick={handleAddTask} className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors">Создать</button>
          </div>
        </div>
      )}

      {/* Gantt chart */}
      <div data-gantt-root="" className="relative">
        <GanttChart
          tasks={project.tasks}
          dependencies={project.dependencies}
          viewMode={viewMode}
          onTaskClick={handleTaskClick}
          onProgressChange={handleProgressChange}
          onDateChange={handleDateChange}
        />
      </div>

      {/* Task list (for tasks without dates) */}
      {project.tasks.filter(t => !t.start_date || !t.due_date).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-brand-text-secondary">Задачи без дат (не на Ганте)</h3>
          {project.tasks.filter(t => !t.start_date || !t.due_date).map(t => (
            <div
              key={t.id}
              onClick={() => handleTaskClick(t)}
              className="bg-brand-surface border border-brand-border rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div>
                <span className="text-brand-text text-sm">{t.title}</span>
                {t.assignee && <span className="text-xs text-brand-text-secondary ml-2">· {t.assignee.name}</span>}
              </div>
              <span className="text-xs text-brand-text-secondary">{t.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Task edit modal ───────────────────────────────────────────────── */}
      {editingTask && (
        <Portal>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setEditingTask(null)}>
          <div className="bg-card border border-brand-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 20px 60px rgba(131,110,254,0.15), 0 4px 16px rgba(0,0,0,0.08)' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
              <h2 className="text-lg font-semibold text-brand-text">Редактирование задачи</h2>
              <button onClick={() => setEditingTask(null)} className="text-brand-text-secondary hover:text-brand-text transition-colors text-xl leading-none">&times;</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Название</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Описание</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400 resize-none"
                />
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Начало</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Окончание</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400"
                  />
                </div>
              </div>

              {/* Assignee & Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Исполнитель</label>
                  <select
                    value={editForm.assignee_id}
                    onChange={e => setEditForm({ ...editForm, assignee_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400"
                  >
                    <option value="">Не назначен</option>
                    {employees.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Приоритет</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400"
                  >
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>
              </div>

              {/* Progress: slider if no checklist, auto-calculated if checklist exists */}
              {checklist.length === 0 ? (
                <div>
                  <label className="text-xs font-medium text-brand-text-secondary mb-1 block">
                    Прогресс: <span className="text-primary-500 font-bold">{editForm.progress}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={editForm.progress}
                    onChange={e => setEditForm({ ...editForm, progress: Number(e.target.value) })}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-[10px] text-brand-text-secondary mt-0.5">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              ) : null}

              {/* ── Checklist section ─────────────────────────────────────── */}
              <div className="border-t border-brand-border pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-brand-text">Чек-лист</span>
                  {checklist.length > 0 && (
                    <span className="text-xs text-brand-text-secondary">
                      {checklist.filter(i => i.is_checked).length} из {checklist.length}
                    </span>
                  )}
                </div>

                {checklist.length > 0 && (() => {
                  const checked = checklist.filter(i => i.is_checked).length
                  const total = checklist.length
                  const pct = Math.round((checked / total) * 100)
                  return (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 bg-brand-surface rounded-full h-2 overflow-hidden border border-brand-border">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)' }}
                          />
                        </div>
                        <span className="text-xs font-medium text-primary-500 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  )
                })()}

                <div className="space-y-1.5">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={item.is_checked}
                        onChange={() => handleToggleChecklistItem(item)}
                        className="w-4 h-4 rounded accent-primary-500 flex-shrink-0 cursor-pointer"
                      />
                      <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-brand-text-secondary' : 'text-brand-text'}`}>
                        {item.title}
                      </span>
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-brand-text-secondary hover:text-red-500 transition-all text-base leading-none flex-shrink-0"
                        title="Удалить пункт"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.75 3.5h10.5M5.25 3.5V2.333a.583.583 0 0 1 .583-.583h2.334a.583.583 0 0 1 .583.583V3.5M11.083 3.5l-.583 7.583a.583.583 0 0 1-.583.584H4.083a.583.583 0 0 1-.583-.584L2.917 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add checklist item */}
                <div className="flex gap-2 mt-3">
                  <input
                    value={newChecklistTitle}
                    onChange={e => setNewChecklistTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem() } }}
                    placeholder="Добавить пункт..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-brand-border bg-card text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400 placeholder:text-brand-text-secondary"
                  />
                  <button
                    onClick={handleAddChecklistItem}
                    disabled={!newChecklistTitle.trim()}
                    className="px-3 py-1.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* ── Comments section ──────────────────────────────────────── */}
              <div className="border-t border-brand-border pt-4 mt-4">
                <div className="text-sm font-semibold text-brand-text mb-3">Комментарии</div>

                {comments.length === 0 && (
                  <p className="text-xs text-brand-text-secondary mb-3">Комментариев пока нет</p>
                )}

                <div className="space-y-3 mb-3">
                  {comments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5 group">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {getInitials(comment.author_id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-brand-text leading-snug">{comment.text}</p>
                        {comment.attachment_url && (
                          <a
                            href={comment.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg bg-brand-surface border border-brand-border text-xs text-primary-500 hover:text-primary-600 hover:border-primary-300 transition-colors max-w-full"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                              <path d="M4.167 2.5H2.5A.833.833 0 0 0 1.667 3.333v4.167A.833.833 0 0 0 2.5 8.333h4.167A.833.833 0 0 0 7.5 7.5V5.833M6.25 1.667H8.333M8.333 1.667v2.083M8.333 1.667 4.583 5.417" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="truncate">{comment.attachment_name || comment.attachment_url}</span>
                          </a>
                        )}
                        <div className="text-[10px] text-brand-text-secondary mt-1">{formatCommentDate(comment.created_at)}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 text-brand-text-secondary hover:text-red-500 transition-all flex-shrink-0 self-start mt-0.5"
                        title="Удалить комментарий"
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.75 3.5h10.5M5.25 3.5V2.333a.583.583 0 0 1 .583-.583h2.334a.583.583 0 0 1 .583.583V3.5M11.083 3.5l-.583 7.583a.583.583 0 0 1-.583.584H4.083a.583.583 0 0 1-.583-.584L2.917 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* New comment input */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                      placeholder="Написать комментарий..."
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400 resize-none placeholder:text-brand-text-secondary"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setShowLinkInput(v => !v)}
                        className={`px-2.5 py-2 rounded-xl border text-sm transition-colors ${showLinkInput ? 'bg-primary-500 border-primary-500 text-white' : 'border-brand-border text-brand-text-secondary hover:text-primary-500 hover:border-primary-300 bg-card'}`}
                        title="Прикрепить ссылку"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5.25 8.75a3.5 3.5 0 0 0 5.071 0l1.75-1.75a3.5 3.5 0 0 0-4.95-4.95l-1.002 1.002M8.75 5.25a3.5 3.5 0 0 0-5.07 0L1.929 7a3.5 3.5 0 0 0 4.95 4.95L7.88 10.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="px-2.5 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Отправить"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12.833 1.167 6.417 7.583M12.833 1.167l-4.083 11.666-2.333-5.25M12.833 1.167 1.167 5.25l5.25 2.333" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {showLinkInput && (
                    <div className="flex gap-2">
                      <input
                        value={newCommentLink}
                        onChange={e => setNewCommentLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-3 py-1.5 rounded-xl border border-brand-border bg-card text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400 placeholder:text-brand-text-secondary"
                      />
                      {newCommentLink && (
                        <button
                          onClick={() => { setNewCommentLink(''); setShowLinkInput(false) }}
                          className="text-brand-text-secondary hover:text-brand-text text-sm px-2"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-brand-border">
              <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-sm text-brand-text-secondary hover:text-brand-text transition-colors">
                Отмена
              </button>
              <button onClick={handleEditSave} className="px-5 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors active:scale-[0.97]">
                Сохранить
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
