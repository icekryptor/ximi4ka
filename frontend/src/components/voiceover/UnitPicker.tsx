import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { unitsApi, ContentUnit, ContentRubric, STATUS_LABELS, ContentStatus } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  rubrics: ContentRubric[]
  onSelect: (unit: ContentUnit) => void
}

export function UnitPicker({ rubrics, onSelect }: Props) {
  const toast = useToast()
  const [items, setItems] = useState<ContentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContentStatus | ''>('')
  const [rubricId, setRubricId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await unitsApi.list({
        limit: 100,
        sort: 'created_at',
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(rubricId ? { rubric_id: rubricId } : {}),
      })
      setItems(r.data)
    } catch {
      toast.error('Не удалось загрузить идеи')
    } finally {
      setLoading(false)
    }
  }, [search, status, rubricId, toast])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-brand-text">Выбор идеи</h2>
        <p className="text-sm text-brand-text-secondary mt-1">
          Идея из контент-банка станет основой сценария.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заголовку, хуку, сути…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ContentStatus | '')}
          className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
        >
          <option value="">Любой статус</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={rubricId}
          onChange={(e) => setRubricId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400"
        >
          <option value="">Любая рубрика</option>
          {rubrics.map((r) => (
            <option key={r.id} value={r.id}>{r.emoji} {r.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-text-secondary">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Ничего не найдено</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {items.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u)}
              className="text-left p-4 rounded-xl border border-brand-border bg-card hover:border-primary-300 hover:bg-subtle transition-colors"
            >
              <div className="text-xs text-brand-text-secondary mb-1">{STATUS_LABELS[u.status]}</div>
              <div className="font-semibold text-brand-text leading-snug">{u.title}</div>
              {u.hook && (
                <div className="text-sm text-brand-text-secondary mt-1 line-clamp-2">→ {u.hook}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
