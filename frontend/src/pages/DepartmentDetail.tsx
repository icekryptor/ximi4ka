import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { departmentsApi, DepartmentDetail as DeptDetail } from '../api/departments'
import { recurringTasksApi, RecurringTask } from '../api/recurringTasks'
import { projectsApi, Project } from '../api/projects'

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dept, setDept] = useState<DeptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'boards' | 'members' | 'recurring' | 'projects'>('boards')
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!id) return
    Promise.all([
      departmentsApi.getOne(id).then(setDept),
      recurringTasksApi.getAll(id).then(setRecurringTasks),
      projectsApi.getAll(id).then(setProjects),
    ])
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !dept) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const tabs = [
    { key: 'boards' as const, label: 'Доски', count: dept.boards.length },
    { key: 'members' as const, label: 'Участники', count: dept.members.length },
    { key: 'recurring' as const, label: 'Регулярные задачи', count: recurringTasks.length },
    { key: 'projects' as const, label: 'Проекты', count: projects.length },
  ]

  const roleLabels: Record<string, string> = {
    head: 'Руководитель',
    member: 'Участник',
    viewer: 'Наблюдатель',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/planning/departments')}
          className="text-brand-text-secondary hover:text-brand-text transition-colors"
        >
          ← Назад
        </button>
        <div
          className="w-5 h-5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dept.color || '#836efe' }}
        />
        <h1 className="text-2xl font-bold text-brand-text">{dept.name}</h1>
      </div>

      <div className="flex gap-1 bg-brand-bg p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-surface text-brand-text shadow-sm'
                : 'text-brand-text-secondary hover:text-brand-text'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === 'boards' && (
        <div className="space-y-3">
          {dept.boards.length === 0 ? (
            <p className="text-brand-text-secondary italic">Нет привязанных досок</p>
          ) : (
            dept.boards.map((board) => (
              <div
                key={board.id}
                onClick={() => navigate(`/planning?board=${board.id}`)}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: board.color || '#836efe' }}
                />
                <span className="text-brand-text font-medium">{board.name}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-3">
          {dept.members.length === 0 ? (
            <p className="text-brand-text-secondary italic">Нет участников</p>
          ) : (
            dept.members.map((m) => (
              <div
                key={m.id}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-brand-text font-medium">{m.user?.name || m.user_id}</div>
                  <div className="text-sm text-brand-text-secondary">{m.user?.email}</div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  m.role === 'head'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : m.role === 'member'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {roleLabels[m.role] || m.role}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'recurring' && (
        <div className="space-y-3">
          {recurringTasks.length === 0 ? (
            <p className="text-brand-text-secondary italic">Нет регулярных задач</p>
          ) : (
            recurringTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/planning/recurring/${task.id}`)}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div>
                  <div className="text-brand-text font-medium">{task.title}</div>
                  <div className="text-sm text-brand-text-secondary">{task.assignee?.name || 'Без исполнителя'}</div>
                </div>
                <span className={`text-sm font-medium ${
                  !task.is_due_today ? 'text-brand-text-secondary' :
                  task.today_report ? 'text-green-600 dark:text-green-400' :
                  'text-amber-600 dark:text-amber-400'
                }`}>
                  {!task.is_due_today ? '—' : task.today_report ? 'Сдан' : 'Ожидает'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <p className="text-brand-text-secondary italic">Нет проектов</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/planning/projects/${p.id}`)}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-brand-text font-medium">{p.name}</div>
                  <span className="text-xs text-brand-text-secondary">{p.task_count} задач</span>
                </div>
                <div className="w-full bg-brand-bg rounded-full h-1.5">
                  <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${p.avg_progress}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
