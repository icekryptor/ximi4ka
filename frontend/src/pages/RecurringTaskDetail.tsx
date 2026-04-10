import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { recurringTasksApi, RecurringTaskDetail as TaskDetail } from '../api/recurringTasks'

const frequencyLabels: Record<string, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  custom: 'По расписанию',
}

const dayLabels = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function RecurringTaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInstruction, setShowInstruction] = useState(false)
  const [reportText, setReportText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    if (!id) return
    recurringTasksApi.getOne(id)
      .then(setTask)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleSubmitReport = async () => {
    if (!id || !reportText.trim()) return
    setSubmitting(true)
    try {
      await recurringTasksApi.submitReport(id, reportText.trim())
      setReportText('')
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !task) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const freqDisplay = task.frequency === 'custom' && task.frequency_days?.length
    ? task.frequency_days.map(d => dayLabels[d]).join(', ')
    : frequencyLabels[task.frequency] || task.frequency

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/planning/recurring')}
          className="text-brand-text-secondary hover:text-brand-text transition-colors"
        >
          ← Назад
        </button>
        <h1 className="text-2xl font-bold text-brand-text">{task.title}</h1>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-brand-text-secondary mb-1">Направление</div>
            <div className="text-brand-text font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.department?.color || '#836efe' }} />
              {task.department?.name}
            </div>
          </div>
          <div>
            <div className="text-brand-text-secondary mb-1">Частота</div>
            <div className="text-brand-text font-medium">{freqDisplay}</div>
          </div>
          <div>
            <div className="text-brand-text-secondary mb-1">Исполнитель</div>
            <div className="text-brand-text font-medium">{task.assignee?.name || '—'}</div>
          </div>
        </div>

        {task.instruction && (
          <div className="mt-4 pt-4 border-t border-brand-border">
            <button
              onClick={() => setShowInstruction(!showInstruction)}
              className="text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              {showInstruction ? 'Скрыть инструкцию' : 'Показать инструкцию'}
            </button>
            {showInstruction && (
              <div className="mt-3 p-4 bg-card rounded-xl text-sm text-brand-text whitespace-pre-wrap">
                {task.instruction}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">Отправить отчёт</h2>
        <textarea
          value={reportText}
          onChange={e => setReportText(e.target.value)}
          placeholder="Текст отчёта..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-brand-border bg-card text-brand-text resize-y"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSubmitReport}
            disabled={!reportText.trim() || submitting}
            className="px-6 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-text">История отчётов</h2>
        {task.reports.length === 0 ? (
          <p className="text-brand-text-secondary italic">Отчётов пока нет</p>
        ) : (
          task.reports.map(report => (
            <div key={report.id} className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-brand-text">
                  {new Date(report.report_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="text-xs text-brand-text-secondary">
                  {report.author?.name || 'Неизвестный'}
                </span>
              </div>
              <p className="text-sm text-brand-text whitespace-pre-wrap">{report.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
