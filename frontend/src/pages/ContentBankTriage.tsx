import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  unitsApi,
  ContentUnit,
  ReviewGrade,
  REVIEW_GRADE_LABELS,
  COMPLEXITY_LABELS,
} from '../api/contentBank'
import { useToast } from '../contexts/ToastContext'

export default function ContentBankTriage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [queue, setQueue] = useState<ContentUnit[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load queue on mount: ungraded by default, optional ?include=excellent,needs_work
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const include = searchParams.get('include')
        const reviewFilter = include
          ? `null,${include}` // also include re-graded ones
          : 'null'
        const rubricFilter = searchParams.get('rubric_id') || undefined
        const r = await unitsApi.list({
          review_grade: reviewFilter,
          rubric_id: rubricFilter,
          limit: 200,
          sort: 'created_at',
        })
        setQueue(r.data)
      } catch {
        toast.error('Ошибка загрузки очереди')
      }
      setLoading(false)
    }
    loadQueue()
  }, [searchParams, toast])

  const current = queue[currentIndex]

  // When current unit changes, sync feedback textarea
  useEffect(() => {
    if (current) setFeedback(current.review_feedback || '')
  }, [current])

  const advance = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, queue.length))
  }, [queue.length])

  const goBack = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const saveAndAdvance = useCallback(async (grade: ReviewGrade) => {
    if (!current || saving) return
    setSaving(true)
    try {
      const updated = await unitsApi.update(current.id, {
        review_grade: grade,
        review_feedback: feedback.trim() || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      // Update queue locally with new value (so back-navigation shows latest)
      setQueue(prev => prev.map((u, i) => i === currentIndex ? updated : u))
      advance()
    } catch {
      toast.error('Ошибка сохранения')
    }
    setSaving(false)
  }, [current, feedback, saving, currentIndex, advance, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-2xl font-bold text-brand-text mb-3">Очередь пуста</h1>
        <p className="text-brand-text-secondary mb-6">
          Все идеи уже размечены. Чтобы переразметить, добавь к URL <code>?include=excellent,needs_work</code>.
        </p>
        <button onClick={() => navigate('/content-bank')} className="btn btn-primary">
          Назад на Контент-банк
        </button>
      </div>
    )
  }

  if (currentIndex >= queue.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 className="text-3xl font-bold text-brand-text mb-3">🎉 Готово</h1>
        <p className="text-brand-text-secondary mb-6">
          Размечено {queue.length} идей. Можешь экспортировать JSON для AI.
        </p>
        <button onClick={() => navigate('/content-bank')} className="btn btn-primary">
          Назад на Контент-банк
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-brand-text">
          Триаж: {currentIndex + 1} / {queue.length}
        </h1>
        <button
          onClick={() => navigate('/content-bank')}
          className="p-2 rounded-lg hover:bg-subtle text-brand-text-secondary"
          title="Закрыть (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-subtle rounded-full h-2 mb-6">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Current unit */}
      <div className="flex-1 max-w-3xl mx-auto w-full space-y-4">
        <div className="flex items-center gap-3 text-sm text-brand-text-secondary">
          {current.rubric && (
            <span>
              {current.rubric.emoji} {current.rubric.title}
            </span>
          )}
          {current.complexity != null && (
            <span>· {COMPLEXITY_LABELS[current.complexity] || ''}</span>
          )}
          {current.review_grade && (
            <span className="ml-auto">
              Текущая оценка: {REVIEW_GRADE_LABELS[current.review_grade]}
            </span>
          )}
        </div>

        {current.hook && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Hook</label>
            <p className="text-xl font-semibold text-brand-text mt-1">{current.hook}</p>
          </div>
        )}
        {current.hook_ab && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Hook A/B</label>
            <p className="text-base text-brand-text mt-1">{current.hook_ab}</p>
          </div>
        )}
        {current.visual && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Визуал</label>
            <p className="text-sm text-brand-text mt-1">{current.visual}</p>
          </div>
        )}
        {current.essence && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Суть</label>
            <p className="text-sm text-brand-text mt-1 whitespace-pre-line">{current.essence}</p>
          </div>
        )}
        {current.notes && (
          <div>
            <label className="text-xs text-brand-text-secondary uppercase tracking-wider">Заметки</label>
            <p className="text-sm text-brand-text-secondary mt-1 whitespace-pre-line">{current.notes}</p>
          </div>
        )}

        {/* Feedback textarea */}
        <div>
          <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
            Фидбек для AI
          </label>
          <textarea
            ref={textareaRef}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Почему эта идея получила такую оценку? Что бы ты улучшил?"
            className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-none"
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="max-w-3xl mx-auto w-full mt-6 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => saveAndAdvance('excellent')}
            disabled={saving}
            className="px-4 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-40"
          >
            ✅ 1 Отлично
          </button>
          <button
            onClick={() => saveAndAdvance('needs_work')}
            disabled={saving}
            className="px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-40"
          >
            ⚠️ 2 Доработать
          </button>
          <button
            onClick={() => saveAndAdvance('rejected')}
            disabled={saving}
            className="px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 disabled:opacity-40"
          >
            ❌ 3 Отказ
          </button>
        </div>

        <div className="flex items-center justify-between text-sm text-brand-text-secondary">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 hover:text-brand-text disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Назад
          </button>
          <span>{currentIndex + 1} / {queue.length}</span>
          <button
            onClick={advance}
            disabled={currentIndex >= queue.length - 1}
            className="flex items-center gap-1 hover:text-brand-text disabled:opacity-40"
          >
            Дальше <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
