import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, ImageIcon, ExternalLink, ChevronRight, GitBranch, Table2 } from 'lucide-react'
import { Component, ComponentPart, componentsApi } from '../api/components'
import { kitsApi, Kit, KitComponent } from '../api/kits'
import ComponentModal from '../components/ComponentModal'
import ComponentPicker from '../components/ComponentPicker'
import KitModal from '../components/KitModal'
import AssemblyTree from '../components/AssemblyTree'

const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактив',
  equipment: 'Комплектующее',
  print: 'Печать',
  labor: 'Работа',
}
const CATEGORY_COLORS: Record<string, string> = {
  reagent: 'bg-blue-100 text-blue-600',
  equipment: 'bg-gray-100 text-gray-600',
  print: 'bg-amber-100 text-amber-600',
  labor: 'bg-green-100 text-green-600',
}
const CATEGORY_ORDER = ['reagent', 'equipment', 'print', 'labor']

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '')
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001')

/** Inline-редактируемое поле количества */
function QuantityCell({ kc, onSave }: { kc: KitComponent; onSave: (qty: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(kc.quantity))
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0 && n !== kc.quantity) onSave(n)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer px-2 py-0.5 rounded hover:bg-gray-100 tabular-nums"
        title="Нажмите для редактирования"
        onClick={() => { setVal(String(kc.quantity)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }}
      >
        {Math.round(Number(kc.quantity))}
      </span>
    )
  }

  return (
    <input
      ref={inputRef}
      className="w-16 text-right border border-blue-400 rounded px-1 py-0.5 text-sm outline-none"
      type="number"
      min="0.001"
      step="any"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

export default function CostCalculation() {
  const [kits, setKits] = useState<Kit[]>([])
  const [activeKitId, setActiveKitId] = useState<string | null>(null)
  const [kitDetails, setKitDetails] = useState<Kit | null>(null)
  const [loading, setLoading] = useState(true)
  const [kitLoading, setKitLoading] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<Component | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [kitModalOpen, setKitModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [partsCache, setPartsCache] = useState<Record<string, ComponentPart[]>>({})
  const fetchedRef = useRef(new Set<string>())

  const toggleExpand = async (componentId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(componentId)) { next.delete(componentId); return next }
      next.add(componentId)
      return next
    })
    if (!partsCache[componentId]) {
      try {
        const parts = await componentsApi.getParts(componentId)
        setPartsCache(prev => ({ ...prev, [componentId]: parts }))
      } catch (e) { console.error(e) }
    }
  }

  const SOLUTION_RE = /раствор/i

  const deepExpand = async (componentId: string, componentName?: string) => {
    if (fetchedRef.current.has(componentId)) return
    fetchedRef.current.add(componentId)
    try {
      const parts = await componentsApi.getParts(componentId)
      setPartsCache(prev => ({ ...prev, [componentId]: parts }))
      const isSolution = componentName && SOLUTION_RE.test(componentName)
      if (!isSolution) {
        setExpandedIds(prev => new Set([...prev, componentId]))
      }
      // Sequential to avoid exhausting Supabase connection pool on serverless
      for (const p of parts) {
        if (p.part.is_composite) await deepExpand(p.part.id, p.part.name)
      }
    } catch (e) { console.error(e) }
  }

  const loadKits = async () => {
    setLoading(true)
    try {
      const data = await kitsApi.getAll()
      const active = data.filter(k => k.is_active)
      setKits(active)
      if (!activeKitId && active.length > 0) setActiveKitId(active[0].id)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadKitDetails = async (id: string) => {
    setKitLoading(true)
    try {
      const data = await kitsApi.getById(id)
      setKitDetails(data)
    } catch (e) {
      console.error(e)
    } finally {
      setKitLoading(false)
    }
  }

  useEffect(() => { loadKits() }, [])
  useEffect(() => { if (activeKitId) loadKitDetails(activeKitId) }, [activeKitId])

  const handleDelete = async (component: Component) => {
    if (!activeKitId) return
    if (!window.confirm(`Удалить «${component.name}» из набора?`)) return
    try {
      await kitsApi.removeComponent(activeKitId, component.id)
      await loadKitDetails(activeKitId)
    } catch (e) { console.error(e) }
  }

  const handleQuantityChange = async (kc: KitComponent, qty: number) => {
    if (!activeKitId) return
    try {
      await kitsApi.updateComponentQuantity(activeKitId, kc.component.id, qty)
      await loadKitDetails(activeKitId)
    } catch (e) { console.error(e) }
  }

  const handleEdit = (component: Component) => {
    setEditingComponent(component)
    setEditModalOpen(true)
  }

  const handleEditSaved = () => {
    setEditModalOpen(false)
    setEditingComponent(null)
    if (activeKitId) loadKitDetails(activeKitId)
  }

  const fmt = (price: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(price)

  // Количество × цена за единицу — актуальная стоимость на набор
  const lineTotal = (kc: KitComponent) => kc.quantity * Number(kc.component.unit_price)

  const allItems = kitDetails?.components ?? []

  useEffect(() => {
    if (!kitDetails?.components) return
    fetchedRef.current.clear()
    // Sequential to avoid Supabase pool exhaustion on Vercel serverless
    ;(async () => {
      for (const kc of (kitDetails.components ?? []).filter(kc => kc.component.is_composite)) {
        await deepExpand(kc.component.id, kc.component.name)
      }
    })()
  }, [kitDetails])

  const { totals, grandTotal } = useMemo(() => {
    const t = CATEGORY_ORDER.reduce((acc, cat) => {
      acc[cat] = allItems.filter(kc => kc.component.category === cat).reduce((s, kc) => s + lineTotal(kc), 0)
      return acc
    }, {} as Record<string, number>)
    return { totals: t, grandTotal: Object.values(t).reduce((s, v) => s + v, 0) }
  }, [allItems])

  const renderPartRows = (
    parts: ComponentPart[],
    accQty: number,
    depth: number,
    keyPrefix: string
  ): React.ReactNode[] => {
    return parts.flatMap((entry, i) => {
      const isLast = i === parts.length - 1
      const isEntryComposite = entry.part.is_composite
      const entryExpanded = expandedIds.has(entry.part.id)
      const subParts = partsCache[entry.part.id] ?? []
      const indentPx = 30 * depth

      const rows: React.ReactNode[] = [
        <tr key={`${keyPrefix}-${entry.id}`}
          className={depth === 1 ? 'bg-violet-50/40' : 'bg-violet-50/20'}
        >
          <td className="relative">
            {isEntryComposite && (
              <button
                onClick={() => toggleExpand(entry.part.id)}
                className="absolute -left-1 top-1/2 -translate-y-1/2 text-violet-400 hover:text-violet-700 cursor-pointer"
                title={entryExpanded ? 'Скрыть состав' : 'Показать состав'}
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${entryExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </td>
          <td className="py-1.5" style={{ paddingLeft: indentPx }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-300 select-none">{isLast ? '└' : '├'}</span>
              {entry.part.image_url ? (
                <img src={`${API_BASE}${entry.part.image_url}`} alt={entry.part.name}
                  className="h-10 w-10 object-contain rounded shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-4 w-4 text-gray-300" />
                </div>
              )}
              <div className="min-w-0 max-w-[180px]">
                <button onClick={() => handleEdit(entry.part)}
                  className="text-sm text-gray-700 hover:text-blue-600 hover:underline text-left transition-colors truncate block w-full"
                  title={entry.part.name}
                >
                  {entry.part.name}
                </button>
              </div>
              {isEntryComposite && (
                <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">СК</span>
              )}
              {entry.part.sku && <span className="text-xs text-gray-400">{entry.part.sku}</span>}
            </div>
          </td>
          <td className="py-1.5">
            {entry.part.factory && <span className="text-xs text-gray-400">{entry.part.factory}</span>}
          </td>
          <td className="py-1.5 text-right text-xs text-gray-500">{fmt(Number(entry.part.cost_materials))}</td>
          <td className="py-1.5 text-right text-xs text-gray-500">{fmt(Number(entry.part.cost_logistics))}</td>
          <td className="py-1.5 text-right text-xs text-gray-500">{fmt(Number(entry.part.cost_labor))}</td>
          <td className="py-1.5 text-right text-xs text-gray-500 tabular-nums">
            ×{Math.round(Number(entry.quantity))}
          </td>
          <td className="py-1.5 text-right text-xs text-gray-600 font-medium">
            {fmt(Number(entry.part.unit_price) * Number(entry.quantity) * accQty)}
          </td>
          <td />
        </tr>
      ]

      if (isEntryComposite && entryExpanded && subParts.length > 0) {
        rows.push(...renderPartRows(subParts, accQty * Number(entry.quantity), depth + 1, `${keyPrefix}-${entry.id}`))
      }

      if (isEntryComposite && entryExpanded && !partsCache[entry.part.id]) {
        rows.push(
          <tr key={`${keyPrefix}-${entry.id}-loading`} className="bg-violet-50/20">
            <td colSpan={9} className="py-2 text-xs text-gray-400" style={{ paddingLeft: indentPx + 24 }}>
              Загрузка состава…
            </td>
          </tr>
        )
      }

      return rows
    })
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded w-72" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Заголовок */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Себестоимость</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-[320px] truncate" title={kitDetails?.name}>
            {kitDetails ? kitDetails.name : 'Выберите набор'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Переключатель Таблица / Схема */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {([
              { mode: 'table', icon: Table2, label: 'Таблица' },
              { mode: 'tree',  icon: GitBranch, label: 'Схема сборки' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => activeKitId && loadKitDetails(activeKitId)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            disabled={!activeKitId}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            <span>Добавить компонент</span>
          </button>
        </div>
      </div>

      {/* Вкладки китов */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {kits.map(kit => (
          <button
            key={kit.id}
            onClick={() => setActiveKitId(kit.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px max-w-[180px] truncate ${
              activeKitId === kit.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            title={kit.name}
          >
            {kit.name}
          </button>
        ))}
        <button
          onClick={() => setKitModalOpen(true)}
          className="ml-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center gap-1 -mb-px"
          title="Добавить набор"
        >
          <Plus className="h-4 w-4" />
          <span>Набор</span>
        </button>
      </div>

      {kitLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-28 bg-gray-100 rounded" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      ) : kitDetails ? (
        <>
          {/* Итоговая карточка */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Итоговая себестоимость</h2>
              <span className="text-2xl font-bold text-gray-900">{fmt(grandTotal)}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
              {[
                { label: 'Материалы', value: allItems.reduce((s, kc) => s + Number(kc.component.cost_materials) * Number(kc.quantity), 0) },
                { label: 'Логистика', value: allItems.reduce((s, kc) => s + Number(kc.component.cost_logistics) * Number(kc.quantity), 0) },
                { label: 'Работа', value: allItems.reduce((s, kc) => s + Number(kc.component.cost_labor) * Number(kc.quantity), 0) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                  <div className="text-base font-semibold text-gray-900">{fmt(value)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CATEGORY_ORDER.map(cat => (
                <div key={cat}>
                  <div className="text-xs text-gray-500 mb-0.5">{CATEGORY_LABELS[cat]}</div>
                  <div className="text-base font-semibold text-gray-900">{fmt(totals[cat])}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Схема сборки */}
          {viewMode === 'tree' && (
            <AssemblyTree
              kitComponents={allItems}
              onOpenComponent={handleEdit}
            />
          )}

          {/* Единая таблица компонентов */}
          {viewMode === 'table' && allItems.length > 0 && (
            <div className="overflow-x-auto mb-8">
            <table className="table-minimal ml-5 min-w-max">
                  <thead>
                    <tr>
                      <th className="w-10" />
                      <th>Название</th>
                      <th>Артикул / Поставщик</th>
                      <th className="text-right">Материалы</th>
                      <th className="text-right">Логистика</th>
                      <th className="text-right">Работа</th>
                      <th className="text-right">Кол-во</th>
                      <th className="text-right">Итого</th>
                      <th className="w-20" />
                    </tr>
                  </thead>
              <tbody>
                    {allItems.map(kc => {
                      const c = kc.component
                      const isComposite = c.is_composite
                      const expanded = expandedIds.has(c.id)
                      const parts = partsCache[c.id] ?? []

                      return (
                        <>
                          <tr key={kc.id} className={isComposite ? 'cursor-default' : ''}>
                            {/* Фото + раскрытие */}
                            <td className="relative">
                              {/* Шеврон вынесен левее колонки */}
                              <button
                                onClick={() => isComposite && toggleExpand(c.id)}
                                className={`absolute -left-5 top-1/2 -translate-y-1/2 transition-colors ${
                                  isComposite
                                    ? 'text-gray-400 hover:text-gray-700 cursor-pointer'
                                    : 'text-transparent cursor-default pointer-events-none'
                                }`}
                                tabIndex={isComposite ? 0 : -1}
                                title={isComposite ? (expanded ? 'Скрыть состав' : 'Показать состав') : undefined}
                              >
                                <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              </button>

                              {c.image_url ? (
                                <img
                                  src={`${API_BASE}${c.image_url}`}
                                  alt={c.name}
                                  className="h-[60px] w-[60px] object-contain rounded"
                                />
                              ) : (
                                <div className="h-[60px] w-[60px] rounded bg-gray-100 flex items-center justify-center">
                                  <ImageIcon className="h-6 w-6 text-gray-300" />
                                </div>
                              )}
                            </td>

                            {/* Название + бейдж "сложный" */}
                            <td>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="min-w-0 max-w-[220px]">
                                  <button
                                    onClick={() => handleEdit(c)}
                                    className="font-medium text-gray-900 leading-tight hover:text-blue-600 hover:underline text-left transition-colors truncate block w-full"
                                    title={c.name}
                                  >
                                    {c.name}
                                  </button>
                                  {(c.dimensions || c.weight_kg) && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {[c.dimensions, c.weight_kg ? `${c.weight_kg} кг` : null]
                                        .filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[c.category] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {CATEGORY_LABELS[c.category]}
                                </span>
                                {isComposite && (
                                  <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">
                                    составной
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Артикул / фабрика / ссылка 1688 */}
                            <td>
                              {c.sku && <div className="text-sm text-gray-700">{c.sku}</div>}
                              {c.factory && <div className="text-xs text-gray-400">{c.factory}</div>}
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

                            <td className="text-right text-gray-500 tabular-nums">{fmt(Number(c.cost_materials))}</td>
                            <td className="text-right text-gray-500 tabular-nums">{fmt(Number(c.cost_logistics))}</td>
                            <td className="text-right text-gray-500 tabular-nums">{fmt(Number(c.cost_labor))}</td>

                            <td className="text-right">
                              <QuantityCell kc={kc} onSave={qty => handleQuantityChange(kc, qty)} />
                            </td>

                            <td className="text-right font-medium">{fmt(lineTotal(kc))}</td>

                            <td>
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => handleEdit(c)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Редактировать"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(c)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Удалить из набора"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Раскрытые детали (рекурсивно) */}
                          {isComposite && expanded && parts.length > 0 &&
                            renderPartRows(parts, Number(kc.quantity), 1, kc.id)}

                          {isComposite && expanded && !partsCache[c.id] && (
                            <tr className="bg-violet-50/40">
                              <td colSpan={9} className="py-2 pl-16 text-xs text-gray-400">
                                Загрузка состава…
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
              </tbody>
            </table>
            </div>
          )}

          {viewMode === 'table' && allItems.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
              <p className="text-gray-400 mb-4">В этом наборе пока нет компонентов</p>
              <button onClick={() => setPickerOpen(true)} className="btn btn-primary">
                Добавить первый компонент
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">Выберите набор</div>
      )}

      {/* Пикер — выбор существующего компонента из каталога */}
      {pickerOpen && activeKitId && (
        <ComponentPicker
          kitId={activeKitId}
          existingComponents={kitDetails?.components ?? []}
          onClose={() => setPickerOpen(false)}
          onAdded={() => { if (activeKitId) loadKitDetails(activeKitId) }}
        />
      )}

      {/* Редактирование компонента (не создание) */}
      {editModalOpen && editingComponent && (
        <ComponentModal
          component={editingComponent}
          onClose={() => { setEditModalOpen(false); setEditingComponent(null) }}
          onSaved={handleEditSaved}
        />
      )}

      {kitModalOpen && (
        <KitModal
          onClose={() => setKitModalOpen(false)}
          onSaved={async (kitId) => {
            setKitModalOpen(false)
            await loadKits()
            setActiveKitId(kitId)
          }}
        />
      )}
    </div>
  )
}
