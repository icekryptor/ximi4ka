import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { metricSnapshotsApi } from '../../api/metricSnapshots'
import type { ContentMetricSnapshot } from '../../api/types'

interface Props {
  publicationId: string
  onClose: () => void
  /** Optional callback when a new snapshot is saved (to refresh parent list). */
  onSnapshotSaved?: (snapshot: ContentMetricSnapshot) => void
}

interface FormFields {
  views: string
  likes: string
  comments: string
  shares: string
  saves: string
  profile_clicks: string
  marketplace_clicks: string
}

const FIELD_LABELS: Record<keyof FormFields, string> = {
  views: 'Просмотры',
  likes: 'Лайки',
  comments: 'Комментарии',
  shares: 'Репосты',
  saves: 'Сохранения',
  profile_clicks: 'Переходы в профиль',
  marketplace_clicks: 'Клики на маркетплейс',
}

const EMPTY_FORM: FormFields = {
  views: '',
  likes: '',
  comments: '',
  shares: '',
  saves: '',
  profile_clicks: '',
  marketplace_clicks: '',
}

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return String(e.response.data.error)
  return fallback
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export function MetricsModal({ publicationId, onClose, onSnapshotSaved }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [snapshots, setSnapshots] = useState<ContentMetricSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormFields>(EMPTY_FORM)
  const [capturedAt, setCapturedAt] = useState(() => new Date().toISOString().slice(0, 16))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    metricSnapshotsApi
      .listByPublication(publicationId)
      .then((data) => { if (!cancelled) { setSnapshots(data); setLoading(false) } })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false)
          toast.error(errorMessage(e, 'Ошибка загрузки снимков'))
        }
      })
    return () => { cancelled = true }
  }, [publicationId])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload = {
        publication_id: publicationId,
        captured_at: new Date(capturedAt).toISOString(),
        captured_by: 'manual' as const,
        views: parseIntOrNull(form.views),
        likes: parseIntOrNull(form.likes),
        comments: parseIntOrNull(form.comments),
        shares: parseIntOrNull(form.shares),
        saves: parseIntOrNull(form.saves),
        profile_clicks: parseIntOrNull(form.profile_clicks),
        marketplace_clicks: parseIntOrNull(form.marketplace_clicks),
      }
      const saved = await metricSnapshotsApi.create(payload)
      setSnapshots([saved, ...snapshots])
      setForm(EMPTY_FORM)
      setCapturedAt(new Date().toISOString().slice(0, 16))
      toast.success('Снимок сохранён')
      onSnapshotSaved?.(saved)
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка сохранения'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Удалить снимок?',
      message: 'Это нельзя отменить.',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await metricSnapshotsApi.delete(id)
      setSnapshots(snapshots.filter((s) => s.id !== id))
      toast.success('Снимок удалён')
    } catch (e) {
      toast.error(errorMessage(e, 'Ошибка удаления'))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-brand-text">Метрики публикации</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-secondary hover:text-brand-text"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Entry form */}
          <div className="space-y-3">
            <h3 className="font-semibold text-brand-text">Новый снимок</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-brand-text-secondary">Дата и время</span>
                <input
                  type="datetime-local"
                  className="input mt-1"
                  value={capturedAt}
                  onChange={(e) => setCapturedAt(e.target.value)}
                  aria-label="Дата и время снимка"
                />
              </label>
              {(Object.keys(FIELD_LABELS) as Array<keyof FormFields>).map((key) => (
                <label key={key} className="block">
                  <span className="text-xs text-brand-text-secondary">{FIELD_LABELS[key]}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="input mt-1"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    aria-label={FIELD_LABELS[key]}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary text-sm inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Сохранение...' : 'Сохранить снимок'}
            </button>
            <p className="text-xs text-brand-text-secondary">
              Снимки кумулятивные — введите текущие значения с платформы.
              Пустые поля означают «нет данных».
            </p>
          </div>

          {/* History */}
          <div className="space-y-2">
            <h3 className="font-semibold text-brand-text">История снимков</h3>
            {loading && <p className="text-sm text-brand-text-secondary">Загрузка…</p>}
            {!loading && snapshots.length === 0 && (
              <p className="text-sm text-brand-text-secondary">Снимков пока нет.</p>
            )}
            {!loading && snapshots.length > 0 && (
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-brand-text-secondary">
                    <tr>
                      <th className="px-2 py-1 text-left">Время</th>
                      <th className="px-2 py-1 text-right">👁</th>
                      <th className="px-2 py-1 text-right">❤️</th>
                      <th className="px-2 py-1 text-right">💬</th>
                      <th className="px-2 py-1 text-right">↗</th>
                      <th className="px-2 py-1 text-right">💾</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-2 py-1 text-xs">
                          {new Date(s.captured_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                          <span className="ml-1 text-brand-text-secondary">({s.captured_by})</span>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.views ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.likes ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.comments ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.shares ?? '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.saves ?? '—'}</td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="text-red-600 hover:text-red-800"
                            aria-label="Удалить снимок"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary text-sm">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
