import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Settings, Search } from 'lucide-react'
import {
  unitsApi,
  rubricsApi,
  ContentUnit,
  ContentRubric,
  ContentStatus,
  ContentType,
  STATUS_LABELS,
  CONTENT_TYPE_LABELS,
} from '../api/contentBank'
import { KNOWN_NETWORKS } from '../lib/networks'
import { useToast } from '../contexts/ToastContext'

function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-brand-text-secondary w-20 shrink-0">{label}:</span>
      <button
        onClick={() => onChange([])}
        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
          selected.length === 0
            ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
        }`}
      >
        Все
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            selected.includes(o.value)
              ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
              : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ContentBank() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState<ContentUnit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rubrics, setRubrics] = useState<ContentRubric[]>([])

  // Filters from URL
  const statusFilter = useMemo(
    () => (searchParams.get('status')?.split(',').filter(Boolean) as ContentStatus[]) || [],
    [searchParams]
  )
  const rubricFilter = useMemo(
    () => searchParams.get('rubric_id')?.split(',').filter(Boolean) || [],
    [searchParams]
  )
  const typeFilter = useMemo(
    () => (searchParams.get('content_type')?.split(',').filter(Boolean) as ContentType[]) || [],
    [searchParams]
  )
  const networkFilter = useMemo(
    () => searchParams.get('network')?.split(',').filter(Boolean) || [],
    [searchParams]
  )
  const searchFromUrl = searchParams.get('search') || ''

  // Local search input mirrors URL but updates with debounce
  const [searchInput, setSearchInput] = useState(searchFromUrl)

  // Sync URL → input when URL changes externally
  useEffect(() => {
    setSearchInput(searchFromUrl)
  }, [searchFromUrl])

  // Debounce input → URL
  useEffect(() => {
    if (searchInput === searchFromUrl) return
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams)
      if (searchInput) sp.set('search', searchInput)
      else sp.delete('search')
      setSearchParams(sp)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 200 }
      if (statusFilter.length > 0) params.status = statusFilter.join(',')
      if (rubricFilter.length > 0) params.rubric_id = rubricFilter.join(',')
      if (typeFilter.length > 0) params.content_type = typeFilter.join(',')
      if (networkFilter.length > 0) params.network = networkFilter.join(',')
      if (searchFromUrl) params.search = searchFromUrl
      const r = await unitsApi.list(params)
      setItems(r.data)
      setTotal(r.pagination.total)
    } catch {
      toast.error('Ошибка загрузки контент-банка')
    }
    setLoading(false)
  }, [statusFilter, rubricFilter, typeFilter, networkFilter, searchFromUrl, toast])

  useEffect(() => {
    load()
  }, [load])

  // Load rubrics once
  useEffect(() => {
    rubricsApi
      .getAll()
      .then(setRubrics)
      .catch(() => toast.error('Не удалось загрузить рубрики'))
  }, [toast])

  const updateParam = (key: string, values: string[]) => {
    const sp = new URLSearchParams(searchParams)
    if (values.length === 0) sp.delete(key)
    else sp.set(key, values.join(','))
    setSearchParams(sp)
  }

  const typeOptions = (Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((v) => ({
    value: v,
    label: CONTENT_TYPE_LABELS[v],
  }))

  const rubricOptions = rubrics.map((r) => ({
    value: r.id,
    label: `${r.emoji ?? ''} ${r.title}`.trim(),
  }))

  const networkOptions = KNOWN_NETWORKS.map((n) => ({ value: n.value, label: n.label }))

  const statusOptions = (Object.keys(STATUS_LABELS) as ContentStatus[]).map((v) => ({
    value: v,
    label: STATUS_LABELS[v],
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-brand-text">Контент-банк</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex items-center gap-2">
            <Settings size={16} />
            <span className="hidden sm:inline">Рубрики</span>
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-secondary" />
          <input
            type="text"
            placeholder="Поиск по названию, hook, описанию..."
            className="input pl-10 w-full"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <FilterChipBar
          label="Тип"
          options={typeOptions}
          selected={typeFilter}
          onChange={(next) => updateParam('content_type', next)}
        />
        <FilterChipBar
          label="Рубрика"
          options={rubricOptions}
          selected={rubricFilter}
          onChange={(next) => updateParam('rubric_id', next)}
        />
        <FilterChipBar
          label="Сети"
          options={networkOptions}
          selected={networkFilter}
          onChange={(next) => updateParam('network', next)}
        />
        <FilterChipBar
          label="Статус"
          options={statusOptions}
          selected={statusFilter}
          onChange={(next) => updateParam('status', next)}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Нет единиц контента</div>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Рубрика
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Статус
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Тип
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">
                    Название / Hook
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Сети</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-brand-border hover:bg-subtle">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.rubric ? (
                        <span>
                          {u.rubric.emoji} {u.rubric.title}
                        </span>
                      ) : (
                        <span className="text-brand-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {STATUS_LABELS[u.status]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {CONTENT_TYPE_LABELS[u.content_type]}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-brand-text max-w-[400px] truncate">
                        {u.title}
                      </div>
                      {u.hook && u.hook !== u.title && (
                        <div className="text-xs text-brand-text-secondary max-w-[400px] truncate">
                          {u.hook}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.publications.map((p) => (
                          <span
                            key={p.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary"
                          >
                            {p.network}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-brand-border text-xs text-brand-text-secondary">
            Показано {items.length} из {total}
          </div>
        </div>
      )}
    </div>
  )
}
