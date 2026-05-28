import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import type { ParsedKR, KrStatus } from '../../lib/okr-parser'

interface Props {
  kr: ParsedKR
  status: KrStatus
  comment?: string
  onChange: (krId: string, status: KrStatus, comment?: string) => void | Promise<void>
  busy?: boolean
  linkCounts?: { projects: number; tasks: number }
}

const STATUS_OPTIONS: Array<{ value: KrStatus; label: string; emoji: string; color: string }> = [
  { value: 'on_track',  label: 'On track',  emoji: '🟢', color: 'bg-green-500' },
  { value: 'at_risk',   label: 'At risk',   emoji: '🟡', color: 'bg-amber-500' },
  { value: 'off_track', label: 'Off track', emoji: '🔴', color: 'bg-red-500' },
  { value: 'done',      label: 'Done',      emoji: '✅', color: 'bg-blue-500' },
  { value: 'unknown',   label: 'Не оценено', emoji: '⚪', color: 'bg-gray-300' },
]

function statusColor(status: KrStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.color ?? 'bg-gray-300'
}

export function KrRow({ kr, status, comment, onChange, busy = false, linkCounts }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState(comment ?? '')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCommentDraft(comment ?? '')
  }, [comment])

  useEffect(() => {
    if (!popoverOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [popoverOpen])

  const handleSelect = async (next: KrStatus) => {
    setPopoverOpen(false)
    await onChange(kr.id, next, commentDraft.trim() || undefined)
  }

  const handleSaveComment = async () => {
    await onChange(kr.id, status, commentDraft.trim() || undefined)
  }

  return (
    <div ref={containerRef} className="relative flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        disabled={busy}
        className={`w-4 h-4 rounded-full shrink-0 mt-1 transition-transform hover:scale-110 disabled:opacity-50 ${statusColor(status)}`}
        title="Изменить статус"
        aria-label={`Статус KR: ${status}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-brand-text">{kr.text}</div>
        <div className="text-xs text-brand-text-secondary mt-0.5">
          {kr.metric ? `${kr.metric} · ` : ''}
          {kr.targetMin}
          {comment && <span className="ml-2 italic">«{comment}»</span>}
        </div>
      </div>

      {linkCounts && (linkCounts.projects > 0 || linkCounts.tasks > 0) && (
        <Link
          to={`/planning/projects?okr_kr=${kr.id}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300"
          title="Открыть проекты этого KR"
        >
          📁 {linkCounts.projects} · ✓ {linkCounts.tasks}
        </Link>
      )}

      {popoverOpen && (
        <div className="absolute left-0 top-7 w-72 bg-card border border-brand-border rounded-xl shadow-lg z-20 p-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void handleSelect(opt.value)}
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-subtle text-sm ${
                opt.value === status ? 'bg-subtle font-medium' : ''
              }`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
              {opt.value === status && <Check size={14} className="ml-auto text-primary-600" />}
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-brand-border">
            <input
              type="text"
              placeholder="Комментарий (опционально)"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveComment().then(() => setPopoverOpen(false))
              }}
              className="input text-xs py-1"
            />
            <div className="flex justify-between mt-2">
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="text-xs text-brand-text-secondary hover:text-brand-text"
              >
                Закрыть
              </button>
              {comment && (
                <button
                  type="button"
                  onClick={() => {
                    setCommentDraft('')
                    void onChange(kr.id, status, undefined)
                    setPopoverOpen(false)
                  }}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={12} /> убрать комментарий
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
