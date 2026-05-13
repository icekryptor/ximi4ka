import { useEffect, useState } from 'react'
import { FileText, Save } from 'lucide-react'
import { brandDocsApi } from '../../api/brandDocs'
import type { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { STRATEGY_SLUG, STRATEGY_TITLE, errorMessage } from './utils'

export const StrategyDocSection = () => {
  const toast = useToast()
  const [doc, setDoc] = useState<BrandDoc | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    brandDocsApi
      .get(STRATEGY_SLUG)
      .then((d) => {
        if (cancelled) return
        setDoc(d)
        setContent(d?.content ?? '')
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(errorMessage(e, 'Не удалось загрузить стратегический документ'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const updated = await brandDocsApi.upsert(STRATEGY_SLUG, {
        title: STRATEGY_TITLE,
        content,
      })
      setDoc(updated)
      toast.success('Стратегический документ сохранён')
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось сохранить стратегический документ'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="card mb-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4 mb-3"></div>
        <div className="h-64 bg-muted rounded"></div>
      </section>
    )
  }

  return (
    <section className="card mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-brand-text flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary-600" />
            <span>Стратегический документ</span>
          </h2>
          <p className="text-brand-text-secondary mt-1">
            Стратегический документ в markdown. Используется AI-промптами при генерации контента.
          </p>
          {doc?.updated_at && (
            <p className="text-xs text-brand-text-secondary/70 mt-1">
              Обновлён: {new Date(doc.updated_at).toLocaleString('ru-RU')}
              {doc.version ? ` · версия ${doc.version}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
        </button>
      </div>
      <textarea
        className="w-full min-h-[24rem] p-4 border border-brand-border rounded-2xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Маркетинг-стратегия&#10;&#10;## Позиционирование&#10;..."
        spellCheck={false}
        aria-label="Стратегический документ (markdown)"
      />
    </section>
  )
}
