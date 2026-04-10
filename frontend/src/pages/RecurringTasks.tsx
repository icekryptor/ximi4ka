import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { recurringTasksApi, RecurringTask } from '../api/recurringTasks'
import { departmentsApi, Department } from '../api/departments'

const frequencyLabels: Record<string, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  custom: 'По расписанию',
}

const dayLabels = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function getFrequencyDisplay(task: RecurringTask): string {
  if (task.frequency === 'custom' && task.frequency_days?.length) {
    return task.frequency_days.map(d => dayLabels[d]).join(', ')
  }
  return frequencyLabels[task.frequency] || task.frequency
}

function getTodayStatus(task: RecurringTask): { label: string; className: string } {
  if (!task.is_due_today) {
    return { label: '— не сегодня', className: 'text-brand-text-secondary' }
  }
  if (task.today_report) {
    return { label: 'Отчёт сдан', className: 'text-green-600 dark:text-green-400' }
  }
  return { label: 'Ожидает', className: 'text-amber-600 dark:text-amber-400' }
}

export default function RecurringTasks() {
  const [tasks, setTasks] = useState<RecurringTask[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', department_id: '', frequency: 'daily', frequency_days: [] as number[], assignee_id: '', instruction: '' })
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    recurringTasksApi.getAll(selectedDept || undefined)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [selectedDept])
  useEffect(() => { departmentsApi.getAll().then(setDepartments).catch(console.error) }, [])

  const handleCreate = async () => {
    if (!form.title || !form.department_id) return
    try {
      await recurringTasksApi.create({
        title: form.title,
        department_id: form.department_id,
        frequency: form.frequency,
        frequency_days: form.frequency === 'custom' ? form.frequency_days : undefined,
        assignee_id: form.assignee_id || undefined,
        instruction: form.instruction || undefined,
      })
      setShowCreate(false)
      setForm({ title: '', department_id: '', frequency: 'daily', frequency_days: [], assignee_id: '', instruction: '' })
      load()
    } catch (err) {
      console.error(err)
    }
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
        <h1 className="text-2xl font-bold text-brand-text">Регулярные задачи</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-border bg-brand-surface text-brand-text text-sm"
          >
            <option value="">Все направления</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
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
          <h2 className="text-lg font-semibold text-brand-text">Новая регулярная задача</h2>
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Название задачи"
            className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-bg text-brand-text"
          />
          <div className="grid grid-cols-2 gap-4">
            <select
              value={form.department_id}
              onChange={e => setForm({ ...form, department_id: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-border bg-brand-bg text-brand-text"
            >
              <option value="">Направление...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={form.frequency}
              onChange={e => setForm({ ...form, frequency: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-border bg-brand-bg text-brand-text"
            >
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
              <option value="custom">По расписанию</option>
            </select>
          </div>
          {form.frequency === 'custom' && (
            <div className="flex gap-2">
              {[1,2,3,4,5,6,7].map(d => (
                <button
                  key={d}
                  onClick={() => {
                    const days = form.frequency_days.includes(d)
                      ? form.frequency_days.filter(x => x !== d)
                      : [...form.frequency_days, d]
                    setForm({ ...form, frequency_days: days })
                  }}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    form.frequency_days.includes(d)
                      ? 'bg-primary-500 text-white'
                      : 'bg-brand-bg text-brand-text-secondary border border-brand-border'
                  }`}
                >
                  {dayLabels[d]}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={form.instruction}
            onChange={e => setForm({ ...form, instruction: e.target.value })}
            placeholder="Инструкция к отчёту (необязательно, неизменяемая)"
            rows={3}
            className="w-full px-4 py-2 rounded-xl border border-brand-border bg-brand-bg text-brand-text"
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-brand-text-secondary hover:text-brand-text transition-colors">Отмена</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors">Создать</button>
          </div>
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left px-6 py-3 text-xs font-medium text-brand-text-secondary uppercase">Задача</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-brand-text-secondary uppercase">Направление</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-brand-text-secondary uppercase">Частота</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-brand-text-secondary uppercase">Исполнитель</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-brand-text-secondary uppercase">Сегодня</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-brand-text-secondary italic">
                  Нет регулярных задач
                </td>
              </tr>
            ) : (
              tasks.map(task => {
                const status = getTodayStatus(task)
                return (
                  <tr
                    key={task.id}
                    onClick={() => navigate(`/planning/recurring/${task.id}`)}
                    className="border-b border-brand-border last:border-0 hover:bg-brand-bg cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 text-brand-text font-medium">{task.title}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-brand-text-secondary">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.department?.color || '#836efe' }} />
                        {task.department?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-text-secondary">{getFrequencyDisplay(task)}</td>
                    <td className="px-6 py-4 text-sm text-brand-text-secondary">{task.assignee?.name || '—'}</td>
                    <td className={`px-6 py-4 text-sm font-medium ${status.className}`}>{status.label}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
