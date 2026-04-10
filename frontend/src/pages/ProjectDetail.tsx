import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import { projectsApi, ProjectDetail as ProjDetail, ProjectTask } from '../api/projects'

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  active: { label: 'Активный', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  on_hold: { label: 'На паузе', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Завершён', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  cancelled: { label: 'Отменён', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
}

function toGanttTasks(tasks: ProjectTask[], dependencies: ProjDetail['dependencies']): GanttTask[] {
  const depMap = new Map<string, string[]>()
  dependencies.forEach(d => {
    const existing = depMap.get(d.successor_id) || []
    existing.push(d.predecessor_id)
    depMap.set(d.successor_id, existing)
  })

  return tasks
    .filter(t => t.start_date && t.due_date)
    .map(t => ({
      id: t.id,
      name: t.title,
      start: new Date(t.start_date!),
      end: new Date(t.due_date!),
      progress: t.progress || 0,
      type: 'task' as const,
      project: t.parent_id || undefined,
      dependencies: depMap.get(t.id) || [],
      styles: {
        progressColor: '#836efe',
        progressSelectedColor: '#6703ff',
      },
    }))
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', start_date: '', due_date: '', assignee_id: '', parent_id: '' })

  const load = () => {
    if (!id) return
    projectsApi.getOne(id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

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

  const handleProgressChange = async (task: GanttTask) => {
    if (!id) return
    try {
      await projectsApi.updateTask(id, task.id, { progress: task.progress })
      load()
    } catch (err) { console.error(err) }
  }

  const handleDateChange = async (task: GanttTask) => {
    if (!id) return
    try {
      await projectsApi.updateTask(id, task.id, {
        start_date: task.start.toISOString().split('T')[0],
        due_date: task.end.toISOString().split('T')[0],
      })
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
  const ganttTasks = toGanttTasks(project.tasks, project.dependencies)
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
        <button
          onClick={() => projectsApi.exportProject(id!)}
          className="ml-auto px-4 py-2 border border-brand-border text-brand-text rounded-xl text-sm font-medium hover:bg-brand-surface transition-colors"
        >
          ⬇ JSON
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-4 gap-4">
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
      </div>

      {/* Gantt toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-card p-1 rounded-xl">
          {[
            { mode: ViewMode.Day, label: 'День' },
            { mode: ViewMode.Week, label: 'Неделя' },
            { mode: ViewMode.Month, label: 'Месяц' },
          ].map(v => (
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
      {ganttTasks.length > 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-4 overflow-x-auto">
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleDateChange}
            onProgressChange={handleProgressChange}
            listCellWidth="155px"
            columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 65}
            barFill={60}
            fontSize="12px"
            headerHeight={50}
            rowHeight={40}
          />
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 text-center">
          <p className="text-brand-text-secondary italic">Нет задач с датами для отображения на диаграмме Ганта</p>
          <p className="text-sm text-brand-text-secondary mt-2">Создайте задачи с датами начала и окончания</p>
        </div>
      )}

      {/* Task list (for tasks without dates) */}
      {project.tasks.filter(t => !t.start_date || !t.due_date).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-brand-text-secondary">Задачи без дат (не на Ганте)</h3>
          {project.tasks.filter(t => !t.start_date || !t.due_date).map(t => (
            <div key={t.id} className="bg-brand-surface border border-brand-border rounded-xl p-3 flex items-center justify-between">
              <span className="text-brand-text text-sm">{t.title}</span>
              <span className="text-xs text-brand-text-secondary">{t.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
