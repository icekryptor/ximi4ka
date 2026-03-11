import { useEffect, useRef, useState } from 'react'
import { X, Search, ImageIcon, Check, Plus } from 'lucide-react'
import { componentsApi, Component } from '../api/components'
import { kitsApi, KitComponent } from '../api/kits'

const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактив',
  equipment: 'Комплектующее',
  print: 'Печатная продукция',
  labor: 'Работа',
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(v)

interface Props {
  kitId: string
  existingComponents: KitComponent[]
  onClose: () => void
  onAdded: () => void
}

export default function ComponentPicker({ kitId, existingComponents, onClose, onAdded }: Props) {
  const [all, setAll] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)  // id компонента, для которого открыт ввод кол-ва
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const qtyRef = useRef<HTMLInputElement>(null)

  const existingIds = new Set(existingComponents.map(kc => kc.component.id))

  useEffect(() => {
    componentsApi.getAll().then(data => {
      setAll(data.filter(c => c.is_active))
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = all.filter(c => {
    const q = search.toLowerCase()
    return !q ||
      c.name.toLowerCase().includes(q) ||
      (c.sku ?? '').toLowerCase().includes(q) ||
      (c.factory ?? '').toLowerCase().includes(q)
  })

  const startAdd = (id: string) => {
    setAdding(id)
    setQty('1')
    setTimeout(() => qtyRef.current?.select(), 0)
  }

  const confirm = async (componentId: string) => {
    const n = parseFloat(qty)
    if (isNaN(n) || n <= 0) return
    setSaving(true)
    try {
      await kitsApi.addComponent(kitId, componentId, n)
      setAdding(null)
      onAdded()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[86vh] flex flex-col">
        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
          <h2 className="text-lg font-semibold text-brand-text">Добавить компонент в набор</h2>
          <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Поиск */}
        <div className="px-6 py-3 border-b border-brand-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-secondary" />
            <input
              autoFocus
              className="input pl-9"
              placeholder="Поиск по названию, артикулу, поставщику…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Список */}
        <div className="overflow-y-auto flex-1 px-6 py-3 space-y-1">
          {loading ? (
            <div className="space-y-2 py-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-brand-text-secondary py-10">
              {all.length === 0 ? 'Каталог пуст — сначала добавьте компоненты в каталоге' : 'Ничего не найдено'}
            </p>
          ) : filtered.map(c => {
            const inKit = existingIds.has(c.id)
            const isAdding = adding === c.id

            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  inKit ? 'bg-green-50' : 'hover:bg-subtle'
                }`}
              >
                {/* Фото */}
                {c.image_url ? (
                  <img
                    src={`${API_BASE}${c.image_url}`}
                    alt={c.name}
                    className="h-10 w-10 object-contain rounded shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-brand-text-secondary" />
                  </div>
                )}

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-brand-text leading-tight truncate">{c.name}</div>
                  <div className="text-xs text-brand-text-secondary flex items-center gap-2 mt-0.5">
                    {c.sku && <span>{c.sku}</span>}
                    <span className="px-1.5 py-0.5 bg-muted rounded text-brand-text-secondary">
                      {CATEGORY_LABELS[c.category] ?? c.category}
                    </span>
                    {c.factory && <span>{c.factory}</span>}
                  </div>
                </div>

                {/* Цена */}
                <div className="text-sm font-medium text-brand-text-secondary shrink-0">
                  {fmt(c.unit_price)}
                </div>

                {/* Действие */}
                <div className="shrink-0">
                  {inKit ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Check className="h-3.5 w-3.5" />
                      В наборе
                    </span>
                  ) : isAdding ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={qtyRef}
                        type="number"
                        min="0.001"
                        step="any"
                        value={qty}
                        onChange={e => setQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirm(c.id); if (e.key === 'Escape') setAdding(null) }}
                        className="w-16 border border-primary-400 rounded px-2 py-1 text-sm text-right outline-none"
                        placeholder="Кол-во"
                      />
                      <button
                        onClick={() => confirm(c.id)}
                        disabled={saving}
                        className="btn btn-primary py-1 px-3 text-xs"
                      >
                        {saving ? '…' : 'Добавить'}
                      </button>
                      <button
                        onClick={() => setAdding(null)}
                        className="text-brand-text-secondary hover:text-brand-text"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startAdd(c.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-text-secondary hover:text-primary-600 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Добавить
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Подвал */}
        <div className="px-6 py-3 border-t border-brand-border shrink-0">
          <p className="text-xs text-brand-text-secondary">
            Компоненты из каталога можно добавить в несколько наборов одновременно. Управление каталогом — в разделе «Компоненты».
          </p>
        </div>
      </div>
    </div>
  )
}
