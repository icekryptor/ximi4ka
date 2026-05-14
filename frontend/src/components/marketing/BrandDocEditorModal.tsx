import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'
import { brandDocsApi } from '../../api/brandDocs'
import type { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  slug: string
  title: string
  onClose: () => void
  /** Called after successful save so parent can refresh its summary view. */
  onSaved?: (doc: BrandDoc) => void
}

function errorMessage(e: unknown, fallback: string): string {
  // Loose-shape error reader — matches the pattern used in StrategyDocSection
  if (typeof e === 'object' && e && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    if (r?.data?.error) return String(r.data.error)
  }
  return fallback
}

export function BrandDocEditorModal({ slug, title, onClose, onSaved }: Props) {
  const toast = useToast()
  const [content, setContent] = useState<string>('')
  const [doc, setDoc] = useState<BrandDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load doc on open
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    brandDocsApi
      .get(slug)
      .then((d) => {
        if (cancelled) return
        setDoc(d)
        setContent(d?.content ?? '')
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(errorMessage(e, 'Не удалось загрузить документ'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, toast])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [saving, onClose])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await brandDocsApi.upsert(slug, { title, content })
      setDoc(updated)
      toast.success('Сохранено')
      onSaved?.(updated)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-semibold text-brand-text">{title}</h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">slug: <code>{slug}</code></p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              disabled={saving}
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="h-96 bg-muted rounded animate-pulse" />
          ) : (
            <>
              <textarea
                autoFocus
                className="w-full min-h-[60vh] p-4 border border-brand-border rounded-2xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# ${title}\n\n…`}
                spellCheck={false}
              />
              {doc?.updated_at && (
                <p className="text-xs text-brand-text-secondary mt-2">
                  Обновлён: {new Date(doc.updated_at).toLocaleString('ru-RU')}
                  {doc.version ? ` · версия ${doc.version}` : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
