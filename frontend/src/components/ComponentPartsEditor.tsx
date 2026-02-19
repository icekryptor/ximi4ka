import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Search, ImageIcon, X } from 'lucide-react'
import { componentsApi, Component, ComponentPart } from '../api/components'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const fmt = (v: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(v)

interface Props {
  compositeId: string
  onTotalsChange: (price: number, weight: number) => void
}

export default function ComponentPartsEditor({ compositeId, onTotalsChange }: Props) {
  const [parts, setParts] = useState<ComponentPart[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<Component[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadParts = async () => {
    try {
      const data = await componentsApi.getParts(compositeId)
      setParts(data)
      const totalPrice = data.reduce((s, p) => s + Number(p.part.unit_price) * Number(p.quantity), 0)
      const totalWeight = data.reduce((s, p) => s + (Number(p.part.weight_kg) || 0) * Number(p.quantity), 0)
      onTotalsChange(totalPrice, totalWeight)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    try {
      const data = await componentsApi.getAll({ onlySimple: true })
      setCatalog(data.filter(c => c.is_active))
    } catch (e) { console.error(e) }
    finally { setCatalogLoading(false) }
  }

  useEffect(() => { loadParts() }, [compositeId])

  const openPicker = () => {
    setSearch('')
    setPickerOpen(true)
    if (catalog.length === 0) loadCatalog()
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  const handleAdd = async (partId: string) => {
    try {
      await componentsApi.addPart(compositeId, partId, 1)
      await loadParts()
      setPickerOpen(false)
    } catch (e: any) {
      if (e.response?.status === 409) {
        setPickerOpen(false) // уже добавлена
      } else {
        console.error(e)
      }
    }
  }

  const handleQtyChange = async (entry: ComponentPart, qty: number) => {
    try {
      await componentsApi.updatePart(compositeId, entry.id, qty)
      await loadParts()
    } catch (e) { console.error(e) }
  }

  const handleRemove = async (entry: ComponentPart) => {
    try {
      await componentsApi.removePart(compositeId, entry.id)
      await loadParts()
    } catch (e) { console.error(e) }
  }

  const existingPartIds = new Set(parts.map(p => p.part_id))

  const filtered = catalog.filter(c => {
    if (existingPartIds.has(c.id)) return false
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.sku ?? '').toLowerCase().includes(q)
  })

  const totalPrice = parts.reduce((s, p) => s + Number(p.part.unit_price) * Number(p.quantity), 0)
  const totalWeight = parts.reduce((s, p) => s + (Number(p.part.weight_kg) || 0) * Number(p.quantity), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Состав</span>
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить деталь
        </button>
      </div>

      {/* Пикер деталей */}
      {pickerOpen && (
        <div className="border border-blue-200 rounded-lg bg-blue-50/30 mb-3 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                ref={searchRef}
                className="input py-1.5 pl-8 text-sm"
                placeholder="Поиск по названию, артикулу…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {catalogLoading ? (
              <p className="text-sm text-gray-400 py-2 text-center">Загрузка…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">
                {catalog.length === 0 ? 'Нет простых компонентов в каталоге' : 'Ничего не найдено'}
              </p>
            ) : filtered.map(c => (
              <div
                key={c.id}
                onClick={() => handleAdd(c.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-white transition-colors"
              >
                {c.image_url ? (
                  <img src={`${API_BASE}${c.image_url}`} alt={c.name} className="h-7 w-7 object-contain rounded shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-3.5 w-3.5 text-gray-300" />
                  </div>
                )}
                <span className="flex-1 text-sm text-gray-800 truncate">{c.name}</span>
                {c.sku && <span className="text-xs text-gray-400">{c.sku}</span>}
                <span className="text-xs font-medium text-gray-600 shrink-0">{fmt(c.unit_price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список деталей */}
      {loading ? (
        <div className="space-y-1.5">
          {[...Array(2)].map((_, i) => <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : parts.length === 0 ? (
        <div className="text-center py-5 border border-dashed border-gray-200 rounded-lg">
          <p className="text-xs text-gray-400">Детали не добавлены</p>
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-1.5 font-medium">Деталь</th>
                <th className="pb-1.5 font-medium text-right">Цена</th>
                <th className="pb-1.5 font-medium text-right">Кол-во</th>
                <th className="pb-1.5 font-medium text-right">Итого</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parts.map(entry => (
                <tr key={entry.id}>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      {entry.part.image_url ? (
                        <img
                          src={`${API_BASE}${entry.part.image_url}`}
                          alt={entry.part.name}
                          className="h-6 w-6 object-contain rounded shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded bg-gray-100 flex items-center justify-center shrink-0">
                          <ImageIcon className="h-3 w-3 text-gray-300" />
                        </div>
                      )}
                      <span className="truncate text-gray-800">{entry.part.name}</span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right text-gray-500">{fmt(entry.part.unit_price)}</td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      defaultValue={entry.quantity}
                      onBlur={e => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v > 0 && v !== entry.quantity) handleQtyChange(entry, v)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      className="w-16 text-right border border-gray-200 rounded px-1.5 py-0.5 text-sm outline-none focus:border-blue-400"
                    />
                  </td>
                  <td className="py-1.5 text-right font-medium text-gray-800">
                    {fmt(Number(entry.part.unit_price) * Number(entry.quantity))}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(entry)}
                      className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Итоги */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
            <span>{totalWeight > 0 ? `Вес: ${totalWeight.toFixed(3)} кг` : ''}</span>
            <span className="font-semibold text-gray-800">
              Итого: {fmt(totalPrice)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
