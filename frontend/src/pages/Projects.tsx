import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, Project } from '../api/projects'
import { departmentsApi, Department } from '../api/departments'

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  active: { label: 'Активный', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  on_hold: { label: 'На паузе', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Завершён', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  cancelled: { label: 'Отменён', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', department_id: '', description: '', budget: '', start_date: '', end_date: '', deliverables: '' })
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    projectsApi.getAll(selectedDept || undefined)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedDept])
  useEffect(() => { departmentsApi.getAll().then(setDepartments).catch(console.error) }, [])

  const handleCreate = async () => {
    if (!form.name || !form.department_id) return
    try {
      await projectsApi.create({
        name: form.name,
        department_id: form.department_id,
        description: form.description || undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        deliverables: form.deliverables || undefined,
      })
      setShowCreate(false)
      setForm({ name: '', department_id: '', description: '', budget: '', start_date: '', end_date: '', deliverables: '' })
      load()
    } catch (err) { console.error(err) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-text">Проекты</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text text-sm"
          >
            <option value="">Все направления</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            + Создать
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-brand-text">Новый проект</h2>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Название проекта" className="w-full px-4 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
          <div className="grid grid-cols-2 gap-4">
            <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text">
              <option value="">Направление...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="Бюджет, ₽" type="number" className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-brand-text-secondary">Начало</label>
              <input value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} type="date" className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
            </div>
            <div>
              <label className="text-xs text-brand-text-secondary">Окончание</label>
              <input value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} type="date" className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
            </div>
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={2} className="w-full px-4 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
          <textarea value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} placeholder="Результаты / deliverables" rows={2} className="w-full px-4 py-2 rounded-xl border border-brand-border bg-card text-brand-text" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-brand-text-secondary hover:text-brand-text transition-colors">Отмена</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors">Создать</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.length === 0 ? (
          <p className="text-brand-text-secondary italic col-span-2">Нет проектов</p>
        ) : (
          projects.map(p => {
            const st = statusLabels[p.status] || statusLabels.draft
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/planning/projects/${p.id}`)}
                className="bg-brand-surface border border-brand-border rounded-2xl p-5 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-brand-text font-semibold">{p.name}</h3>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.className}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-brand-text-secondary mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.department?.color || '#836efe' }} />
                  {p.department?.name}
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-brand-text-secondary">{p.task_count} задач</span>
                  <span className="text-brand-text font-medium">{p.avg_progress}%</span>
                </div>
                <div className="w-full bg-card rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${p.avg_progress}%` }} />
                </div>
                {p.end_date && (
                  <div className="mt-2 text-xs text-brand-text-secondary">
                    Дедлайн: {new Date(p.end_date).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
