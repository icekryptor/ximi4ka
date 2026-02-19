import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ImageIcon, Search, ExternalLink } from 'lucide-react'
import { componentsApi, Component } from '../api/components'
import ComponentModal from '../components/ComponentModal'

const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактив',
  equipment: 'Комплектующее',
  print: 'Печатная продукция',
  labor: 'Работа',
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(v)

export default function ComponentsCatalog() {
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Component | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await componentsApi.getAll()
      setComponents(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (c: Component) => {
    if (!window.confirm(`Удалить компонент «${c.name}»?\nОн будет удалён из всех наборов.`)) return
    try {
      await componentsApi.delete(c.id)
      setComponents(prev => prev.filter(x => x.id !== c.id))
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = components.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.sku ?? '').toLowerCase().includes(q) ||
      (c.factory ?? '').toLowerCase().includes(q)
    const matchCat = !categoryFilter || c.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="p-8">
      {/* Заголовок */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Каталог компонентов</h1>
          <p className="text-sm text-gray-500 mt-1">
            Все компоненты · {components.length} позиций
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Новый компонент
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Поиск по названию, артикулу…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-48"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">Все категории</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Таблица */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          {components.length === 0 ? (
            <>
              <p className="text-gray-400 mb-4">Каталог пуст</p>
              <button
                onClick={() => { setEditing(null); setModalOpen(true) }}
                className="btn btn-primary"
              >
                Добавить первый компонент
              </button>
            </>
          ) : (
            <p className="text-gray-400">Ничего не найдено</p>
          )}
        </div>
      ) : (
        <table className="table-minimal">
          <thead>
            <tr>
              <th className="w-10" />
              <th>Название</th>
              <th>Артикул</th>
              <th>Категория</th>
              <th>Фабрика / поставщик</th>
              <th>Размеры / вес</th>
              <th className="text-right">Цена за ед.</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  {c.image_url ? (
                    <img
                      src={`${API_BASE}${c.image_url}`}
                      alt={c.name}
                      className="h-9 w-9 object-contain rounded"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </td>
                <td>
                  <div className="font-medium text-gray-900">{c.name}</div>
                  {c.link_1688 && (
                    <a
                      href={c.link_1688}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink className="h-3 w-3" />1688
                    </a>
                  )}
                </td>
                <td className="text-sm text-gray-600">{c.sku ?? '—'}</td>
                <td>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                </td>
                <td className="text-sm text-gray-600">{c.factory ?? '—'}</td>
                <td className="text-sm text-gray-500">
                  {[c.dimensions, c.weight_kg ? `${c.weight_kg} кг` : null].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="text-right font-medium text-gray-900">{fmt(c.unit_price)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => { setEditing(c); setModalOpen(true) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <ComponentModal
          component={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={() => { setModalOpen(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}
