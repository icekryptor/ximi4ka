import { useEffect, useState } from 'react'
import { Package, FlaskConical, Wrench, Printer, HardHat, ChevronDown, ChevronRight, ImageIcon } from 'lucide-react'
import { Kit, KitComponent } from '../api/kits'
import { ComponentPart, componentsApi } from '../api/components'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '')
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001')

const CATEGORY_ICONS: Record<string, typeof FlaskConical> = {
  reagent: FlaskConical,
  equipment: Wrench,
  print: Printer,
  labor: HardHat,
}

const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактив',
  equipment: 'Комплектующее',
  print: 'Печать',
  labor: 'Работа',
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  reagent:   { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  iconBg: 'bg-blue-100' },
  equipment: { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-700',  iconBg: 'bg-gray-100' },
  print:     { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
  labor:     { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', iconBg: 'bg-green-100' },
}

const fmt = (price: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(price)

interface Props {
  kit: Kit
}

export default function AssemblyScheme({ kit }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [partsMap, setPartsMap] = useState<Record<string, ComponentPart[]>>({})
  const [loading, setLoading] = useState(false)

  const components = kit.components ?? []
  const compositeIds = components.filter(kc => kc.component.is_composite).map(kc => kc.component.id)

  // Auto-load parts for all composite components
  useEffect(() => {
    if (compositeIds.length === 0) return
    const missing = compositeIds.filter(id => !partsMap[id])
    if (missing.length === 0) return

    setLoading(true)
    Promise.all(
      missing.map(id =>
        componentsApi.getParts(id).then(parts => ({ id, parts })).catch(() => ({ id, parts: [] as ComponentPart[] }))
      )
    ).then(results => {
      setPartsMap(prev => {
        const next = { ...prev }
        results.forEach(r => { next[r.id] = r.parts })
        return next
      })
    }).finally(() => setLoading(false))
  }, [compositeIds.join(',')])

  if (components.length === 0) return null

  // Group by category
  const CATEGORY_ORDER = ['reagent', 'equipment', 'print', 'labor']
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = components.filter(kc => kc.component.category === cat)
    return acc
  }, {} as Record<string, KitComponent[]>)

  return (
    <div className="mb-6">
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-3 group"
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          : <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        }
        <h2 className="text-base font-semibold text-gray-900">Схема сборки</h2>
        <span className="text-xs text-gray-400 font-normal">
          {components.length} компонент{components.length === 1 ? '' : components.length < 5 ? 'а' : 'ов'}
        </span>
      </button>

      {!collapsed && (
        <div className="relative ml-2">
          {/* Kit root node */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{kit.name}</div>
              <div className="text-xs text-gray-500">
                Партия: {kit.batch_size} шт · {components.length} компонент{components.length === 1 ? '' : components.length < 5 ? 'а' : 'ов'}
              </div>
            </div>
          </div>

          {/* Tree branches */}
          <div className="ml-5 border-l-2 border-violet-200 pl-0">
            {CATEGORY_ORDER.map(cat => {
              const items = grouped[cat]
              if (items.length === 0) return null

              const colors = CATEGORY_COLORS[cat]
              const Icon = CATEGORY_ICONS[cat]
              const isLastCategory = cat === CATEGORY_ORDER.filter(c => grouped[c].length > 0).slice(-1)[0]

              return (
                <div key={cat} className="relative">
                  {/* Horizontal branch line to category */}
                  <div className="absolute -left-px top-5 w-4 border-t-2 border-violet-200" />

                  <div className={`ml-4 mb-3 ${isLastCategory ? '' : ''}`}>
                    {/* Category header */}
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} mb-2`}>
                      <Icon className="h-3 w-3" />
                      {CATEGORY_LABELS[cat]}
                      <span className="opacity-60">({items.length})</span>
                    </div>

                    {/* Components in category */}
                    <div className="space-y-1.5">
                      {items.map((kc, idx) => {
                        const c = kc.component
                        const isComposite = c.is_composite
                        const parts = partsMap[c.id] ?? []
                        const isLast = idx === items.length - 1
                        const lineTotal = kc.quantity * Number(c.unit_price)

                        return (
                          <div key={kc.id}>
                            {/* Component row */}
                            <div className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group ${
                              isComposite ? 'bg-violet-50/30' : ''
                            }`}>
                              {/* Tree connector */}
                              <span className="text-violet-300 text-sm font-mono select-none w-3 text-center shrink-0">
                                {isLast ? '└' : '├'}
                              </span>

                              {/* Image */}
                              {c.image_url ? (
                                <img
                                  src={`${API_BASE}${c.image_url}`}
                                  alt={c.name}
                                  className="h-8 w-8 object-contain rounded shrink-0"
                                />
                              ) : (
                                <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${colors.iconBg}`}>
                                  <Icon className={`h-4 w-4 ${colors.text} opacity-50`} />
                                </div>
                              )}

                              {/* Name + badges */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium text-gray-800">
                                    {c.name}
                                  </span>
                                  {isComposite && (
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                                      составной
                                    </span>
                                  )}
                                </div>
                                {c.sku && (
                                  <div className="text-[10px] text-gray-400">{c.sku}</div>
                                )}
                              </div>

                              {/* Quantity */}
                              <span className="text-xs text-gray-500 tabular-nums shrink-0">
                                ×{Math.round(Number(kc.quantity))}
                              </span>

                              {/* Price */}
                              <span className="text-xs font-medium text-gray-700 tabular-nums shrink-0 w-20 text-right">
                                {fmt(lineTotal)}
                              </span>
                            </div>

                            {/* Composite sub-parts */}
                            {isComposite && parts.length > 0 && (
                              <div className="ml-8 mt-1 mb-2 pl-3 border-l border-violet-200/60">
                                {parts.map((entry, pi) => {
                                  const p = entry.part
                                  const isPartLast = pi === parts.length - 1
                                  const partIcon = CATEGORY_ICONS[p.category] ?? Wrench
                                  const partColors = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.equipment

                                  return (
                                    <div
                                      key={entry.id}
                                      className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-violet-50/50 transition-colors"
                                    >
                                      <span className="text-violet-200 text-xs font-mono select-none w-3 text-center shrink-0">
                                        {isPartLast ? '└' : '├'}
                                      </span>

                                      {p.image_url ? (
                                        <img
                                          src={`${API_BASE}${p.image_url}`}
                                          alt={p.name}
                                          className="h-6 w-6 object-contain rounded shrink-0"
                                        />
                                      ) : (
                                        <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${partColors.iconBg}`}>
                                          {(() => { const PIcon = partIcon; return <PIcon className={`h-3 w-3 ${partColors.text} opacity-40`} /> })()}
                                        </div>
                                      )}

                                      <span className="text-xs text-gray-600 flex-1">
                                        {p.name}
                                      </span>

                                      <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                                        ×{Math.round(Number(entry.quantity))}
                                      </span>

                                      <span className="text-[10px] text-gray-500 tabular-nums shrink-0 w-16 text-right">
                                        {fmt(Number(p.unit_price) * Number(entry.quantity))}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Loading sub-parts */}
                            {isComposite && loading && !partsMap[c.id] && (
                              <div className="ml-12 py-1 text-[10px] text-gray-400">
                                Загрузка состава…
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
