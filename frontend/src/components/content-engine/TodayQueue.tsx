import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { QueueItem } from '../../api/contentEngine'

interface Props {
  queue: QueueItem[]
  /**
   * If provided, called with the QueueItem's unit_id instead of navigating
   * to /content-bank?search=. Lets the parent open the edit modal directly
   * when TodayQueue is rendered inside the content-bank page itself.
   */
  onUnitClick?: (unitId: string) => void
}

const NETWORK_LABEL: Record<string, string> = {
  tiktok: 'TT',
  youtube: 'YT',
  instagram: 'IG',
}

const NETWORK_CLASSES: Record<string, string> = {
  tiktok: 'bg-black text-white',
  youtube: 'bg-red-100 text-red-700',
  instagram: 'bg-pink-100 text-pink-700',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function TodayQueue({ queue, onUnitClick }: Props) {
  const navigate = useNavigate()

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-text mb-1">Сегодняшняя очередь</h2>
        <p className="text-sm text-brand-text-secondary">Сегодня публикаций нет</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      <h2 className="text-sm font-semibold text-brand-text mb-3">
        Сегодняшняя очередь · {queue.length}
      </h2>
      <ul className="space-y-2">
        {queue.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => {
                if (onUnitClick) onUnitClick(q.unit_id)
                else navigate(`/content-bank?search=${encodeURIComponent(q.unit_title)}`)
              }}
              className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-subtle transition-colors"
            >
              <span className="font-mono text-sm text-brand-text-secondary w-12 shrink-0">
                {formatTime(q.scheduled_at)}
              </span>
              <span
                className={
                  'text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ' +
                  (NETWORK_CLASSES[q.network] ?? 'bg-subtle text-brand-text-secondary')
                }
              >
                {NETWORK_LABEL[q.network] ?? q.network}
              </span>
              <span className="flex-1 text-sm text-brand-text truncate">{q.unit_title}</span>
              {q.has_video ? (
                <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                  <CheckCircle2 size={12} /> видео
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                  <AlertTriangle size={12} /> нет видео
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
