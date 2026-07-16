import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Minus, Plus, ChevronsRight, ChevronsLeft } from 'lucide-react'
import { AssemblyNode, fmtRub } from '../../api/assembly'

/** id всех узлов с детьми до глубины `maxDepth` (0 = только корень). */
const idsToDepth = (node: AssemblyNode, maxDepth: number, depth = 0, acc: Set<string> = new Set()): Set<string> => {
  if (node.children.length > 0 && depth < maxDepth) {
    acc.add(node.id)
    for (const ch of node.children) idsToDepth(ch, maxDepth, depth + 1, acc)
  }
  return acc
}

/** id ВСЕХ узлов, у которых есть дети (полное раскрытие). */
const allExpandableIds = (node: AssemblyNode, acc: Set<string> = new Set()): Set<string> => {
  if (node.children.length > 0) {
    acc.add(node.id)
    for (const ch of node.children) allExpandableIds(ch, acc)
  }
  return acc
}

/**
 * Дерево сборки справа-налево: корень (готовый набор) справа,
 * ➕ раскрывает части влево. Без graph-библиотек — рекурсивный flex
 * с CSS-скобками (горизонтальный стык от ребёнка + вертикальная шина + стык к родителю).
 *
 * Клик по узлу — карточка узла. Клик по любой линии скобки — карточка
 * РОДИТЕЛЬСКОГО композита (операция привязана к композиту, который производится).
 */

interface AssemblyTreeProps {
  root: AssemblyNode
  selectedId: string | null
  onSelect: (id: string) => void
}

type EdgePosition = 'single' | 'first' | 'middle' | 'last'

const edgeLineCls = (active: boolean) =>
  active ? 'bg-primary-500' : 'bg-brand-border group-hover:bg-primary-400'

// Ячейка-ребро в строке ребёнка: горизонтальный стык + сегмент вертикальной шины.
// Вся ячейка кликабельна (расширенная hit-area) → выбор родительского композита.
const EdgeCell = ({ position, active, onClick }: { position: EdgePosition; active: boolean; onClick: () => void }) => (
  <div
    className="group relative w-5 shrink-0 cursor-pointer self-stretch"
    onClick={onClick}
    title="Операции сборки"
  >
    {/* горизонталь: от чипа ребёнка к вертикальной шине */}
    <div className={`absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 transition-colors ${edgeLineCls(active)}`} />
    {/* сегмент вертикальной шины (справа): first — вниз от центра, last — вверх до центра */}
    {position !== 'single' && (
      <div
        className={`absolute right-0 w-0.5 transition-colors ${edgeLineCls(active)} ${
          position === 'first' ? 'bottom-0 top-1/2' : position === 'last' ? 'bottom-1/2 top-0' : 'bottom-0 top-0'
        }`}
      />
    )}
  </div>
)

// Стык от вертикальной шины к родительскому чипу
const ParentStub = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <div
    className="group relative w-5 shrink-0 cursor-pointer self-stretch"
    onClick={onClick}
    title="Операции сборки"
  >
    <div className={`absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 transition-colors ${edgeLineCls(active)}`} />
  </div>
)

interface NodeChipProps {
  node: AssemblyNode
  isOpen: boolean
  selected: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

const NodeChip = ({ node, isOpen, selected, onToggle, onSelect }: NodeChipProps) => {
  const hasChildren = node.children.length > 0
  const noPrice = !node.isComposite && node.materialCost === 0

  return (
    <div
      onClick={() => onSelect(node.id)}
      className={`my-1 w-72 shrink-0 cursor-pointer rounded-xl border bg-card px-3 py-2 shadow-soft transition-all ${
        selected
          ? 'border-primary-500 ring-2 ring-primary-400/40'
          : 'border-brand-border hover:border-primary-300 hover:shadow-card'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-brand-border text-brand-text-secondary transition-colors hover:border-primary-400 hover:text-primary-600"
            title={isOpen ? 'Свернуть' : 'Раскрыть состав'}
          >
            {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        )}
        <span className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium leading-snug text-brand-text" title={node.name}>
          {node.name}
        </span>
        {node.quantity !== 1 && (
          <span className="shrink-0 text-xs text-brand-text-secondary">×{node.quantity}</span>
        )}
        {node.stageMax > 0 && (
          <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
            Этап {node.stageMax}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-sm font-bold text-brand-text">{fmtRub(node.totalCost)} ₽</span>
        <span className="truncate text-xs text-brand-text-secondary" title="материалы + работа">
          {fmtRub(node.materialCost)} + {fmtRub(node.laborCost)} раб.
        </span>
        {noPrice && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-amber-600" title="Цена компонента не внесена">
            <AlertTriangle className="h-3 w-3" /> нет цены
          </span>
        )}
      </div>
    </div>
  )
}

interface TreeBranchProps {
  node: AssemblyNode
  expanded: Set<string>
  selectedId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

const TreeBranch = ({ node, expanded, selectedId, onToggle, onSelect }: TreeBranchProps) => {
  const hasChildren = node.children.length > 0
  const isOpen = hasChildren && expanded.has(node.id)
  const edgeActive = selectedId === node.id

  const edgePosition = (i: number): EdgePosition => {
    if (node.children.length === 1) return 'single'
    if (i === 0) return 'first'
    if (i === node.children.length - 1) return 'last'
    return 'middle'
  }

  return (
    <div className="flex items-center">
      {isOpen && (
        <div className="flex flex-col">
          {node.children.map((child, i) => (
            <div key={`${child.id}-${i}`} className="flex items-center justify-end">
              <TreeBranch
                node={child}
                expanded={expanded}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
              />
              <EdgeCell position={edgePosition(i)} active={edgeActive} onClick={() => onSelect(node.id)} />
            </div>
          ))}
        </div>
      )}
      {isOpen && <ParentStub active={edgeActive} onClick={() => onSelect(node.id)} />}
      <NodeChip
        node={node}
        isOpen={isOpen}
        selected={selectedId === node.id}
        onToggle={onToggle}
        onSelect={onSelect}
      />
    </div>
  )
}

export const AssemblyTree = ({ root, selectedId, onSelect }: AssemblyTreeProps) => {
  // Дефолт: раскрыты 2 уровня от корня — схема видна сразу, не «пусто»
  const [expanded, setExpanded] = useState<Set<string>>(() => idsToDepth(root, 2))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setExpanded(idsToDepth(root, 2))
  }, [root.id])

  // Корень справа — при смене дерева прокручиваем вправо
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [root.id])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(allExpandableIds(root))
  const collapseAll = () => setExpanded(new Set([root.id]))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={expandAll}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-card px-2.5 py-1 text-xs text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700">
          <ChevronsLeft className="h-3.5 w-3.5" /> Развернуть всё
        </button>
        <button onClick={collapseAll}
          className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-card px-2.5 py-1 text-xs text-brand-text-secondary transition-colors hover:border-primary-300 hover:text-primary-700">
          <ChevronsRight className="h-3.5 w-3.5" /> Свернуть
        </button>
      </div>
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex min-w-max justify-end pr-1">
          <TreeBranch node={root} expanded={expanded} selectedId={selectedId} onToggle={toggle} onSelect={onSelect} />
        </div>
      </div>
    </div>
  )
}
