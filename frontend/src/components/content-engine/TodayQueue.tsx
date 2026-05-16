import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, X, ExternalLink } from 'lucide-react'
import {
  publicationsApi,
  ContentPublication,
  ContentUnit,
} from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'

type PublicationWithUnit = ContentPublication & { content_unit: ContentUnit }

interface Props {
  /**
   * Called when operator clicks unit title — opens the edit modal.
   * Receives content_unit_id (not publication id).
   */
  onUnitClick?: (unitId: string) => void
}

const NETWORK_LABEL: Record<string, string> = {
  tiktok: 'TT',
  youtube: 'YT',
  youtube_shorts: 'YT',
  instagram: 'IG',
  reels: 'IG',
  telegram: 'TG',
  vk: 'VK',
}

const NETWORK_CLASSES: Record<string, string> = {
  tiktok: 'bg-black text-white',
  youtube: 'bg-red-100 text-red-700',
  youtube_shorts: 'bg-red-100 text-red-700',
  instagram: 'bg-pink-100 text-pink-700',
  reels: 'bg-pink-100 text-pink-700',
  telegram: 'bg-blue-100 text-blue-700',
  vk: 'bg-blue-50 text-blue-700',
}

function formatTime(iso: string | null): string {
  if (!iso) return '—:—'
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function TodayQueue({ onUnitClick }: Props) {
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState<PublicationWithUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState<string | null>(null) // publication id with inline url form
  const [urlInput, setUrlInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await publicationsApi.todayList()
      setItems(list)
    } catch {
      toast.error('Не удалось загрузить очередь публикаций')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // No deps — load once on mount. Refresh after publish/unpublish actions.
  }, [])

  const handleCheckboxClick = (pub: PublicationWithUnit) => {
    if (pub.published_at) {
      // Already published — toggle off (clear published_at + url).
      void toggleUnpublish(pub.id)
    } else {
      // Open inline URL form for this row.
      setOpenForm(pub.id)
      setUrlInput('')
    }
  }

  const toggleUnpublish = async (pubId: string) => {
    setBusy(true)
    try {
      await publicationsApi.update(pubId, {
        published_at: null,
        published_url: null,
      })
      toast.success('Отметка о публикации снята')
      await load()
    } catch {
      toast.error('Не удалось снять отметку')
    } finally {
      setBusy(false)
    }
  }

  const submitPublish = async (pubId: string) => {
    const url = urlInput.trim()
    if (!url) {
      toast.error('Введи URL опубликованного поста')
      return
    }
    setBusy(true)
    try {
      await publicationsApi.update(pubId, {
        published_at: new Date().toISOString(),
        published_url: url,
      })
      toast.success('Опубликовано')
      setOpenForm(null)
      setUrlInput('')
      await load()
    } catch {
      toast.error('Не удалось сохранить публикацию')
    } finally {
      setBusy(false)
    }
  }

  const publishedCount = items.filter((p) => !!p.published_at).length
  const total = items.length
  const progressPct = total === 0 ? 0 : Math.round((publishedCount / total) * 100)

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-border bg-card p-4">
        <div className="h-4 bg-muted rounded w-1/3 mb-3 animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-card p-4">
        <h2 className="text-sm font-semibold text-brand-text mb-1">Сегодняшняя очередь</h2>
        <p className="text-sm text-brand-text-secondary">Сегодня публикаций нет</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-card p-4">
      {/* Header: title + progress bar */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-brand-text shrink-0">
          Сегодняшняя очередь · {total}
        </h2>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <div className="h-1.5 w-32 rounded-full bg-subtle overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs text-brand-text-secondary whitespace-nowrap">
            {publishedCount} / {total} опубликовано
          </span>
        </div>
      </div>

      <ul className="space-y-1">
        {items.map((pub) => {
          const isPublished = !!pub.published_at
          const isFormOpen = openForm === pub.id
          return (
            <li
              key={pub.id}
              className={
                'rounded-lg p-2 ' +
                (isPublished ? 'opacity-60 ' : '') +
                'hover:bg-subtle transition-colors'
              }
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPublished}
                  disabled={busy}
                  onChange={() => handleCheckboxClick(pub)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded shrink-0"
                  title={isPublished ? 'Снять отметку о публикации' : 'Отметить как опубликовано'}
                />
                <span className="font-mono text-sm text-brand-text-secondary w-12 shrink-0">
                  {formatTime(pub.scheduled_at)}
                </span>
                <span
                  className={
                    'text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ' +
                    (NETWORK_CLASSES[pub.network] ?? 'bg-subtle text-brand-text-secondary')
                  }
                >
                  {NETWORK_LABEL[pub.network] ?? pub.network}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onUnitClick) onUnitClick(pub.content_unit_id)
                    else navigate(`/content-bank?search=${encodeURIComponent(pub.content_unit.title)}`)
                  }}
                  className="flex-1 text-left text-sm text-brand-text truncate hover:underline"
                >
                  {pub.content_unit.title}
                </button>

                {isPublished && pub.published_url ? (
                  <a
                    href={pub.published_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:underline shrink-0 max-w-[140px] truncate"
                    title={pub.published_url}
                  >
                    <ExternalLink size={12} /> ссылка
                  </a>
                ) : pub.content_unit.video_url ? (
                  <span className="flex items-center gap-1 text-xs text-green-700 shrink-0">
                    <CheckCircle2 size={12} /> видео
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-700 shrink-0">
                    <AlertTriangle size={12} /> нет видео
                  </span>
                )}
              </div>

              {/* Inline URL form when checkbox-click opened it */}
              {isFormOpen && (
                <div className="mt-2 ml-8 flex items-center gap-2">
                  <input
                    type="url"
                    autoFocus
                    placeholder="https://… (URL опубликованного поста)"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitPublish(pub.id)
                      if (e.key === 'Escape') {
                        setOpenForm(null)
                        setUrlInput('')
                      }
                    }}
                    className="input text-sm py-1 flex-1"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => void submitPublish(pub.id)}
                    disabled={busy || !urlInput.trim()}
                    className="text-xs px-2 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    Опубликовать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenForm(null)
                      setUrlInput('')
                    }}
                    className="p-1 hover:bg-subtle rounded"
                    aria-label="Отменить"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
