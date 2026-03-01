import { useEffect, useState } from 'react'
import { ImageIcon, ExternalLink, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { componentsApi, Component, ComponentPart } from '../api/components'
import { KitComponent } from '../api/kits'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '')
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001')

const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактив', metal: 'Металл', equipment: 'Комплектующее', print: 'Печать', labor: 'Работа',
}

const SOLUTION_RE = /раствор/i

const STAGE_STYLES = [
  { bg: 'bg-gray-900', text: 'text-white',    border: 'border-gray-800', badge: 'bg-white/20 text-white',    label: 'Готовый набор' },
  { bg: 'bg-gray-700', text: 'text-white',    border: 'border-gray-600', badge: 'bg-white/20 text-white',    label: 'Стадия 3' },
  { bg: 'bg-gray-400', text: 'text-white',    border: 'border-gray-400', badge: 'bg-white/30 text-white',    label: 'Стадия 2' },
  { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', badge: 'bg-gray-200 text-gray-600', label: 'Стадия 1' },
  { bg: 'bg-white',    text: 'text-gray-600', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-500', label: 'Сырьё' },
]

function getStageStyle(depth: number, maxDepth: number) {
  const idx = Math.round((depth / Math.max(maxDepth, 1)) * (STAGE_STYLES.length - 1))
  return STAGE_STYLES[idx]
}

function getStageNumber(depth: number, maxDepth: number) {
  return maxDepth - depth + 1
}

interface TreeNode { component: Component; quantity: number; children?: TreeNode[] }

function getMaxDepth(nodes: TreeNode[], current = 0): number {
  let max = current
  for (const n of nodes) {
    if (n.children?.length) max = Math.max(max, getMaxDepth(n.children, current + 1))
  }
  return max
}

/* connector constants */
const CHIP_MID = 32  // vertical center of image from chip top (py-2.5 + mt-0.5 + h-10/2)
const LW = 1         // line width
const LC = '#d1d5db' // line color (gray-300)
const VI = 24        // indent for vertical connectors
const HS = 14        // horizontal-layout stem height
const HD = 14        // horizontal-layout drop height
const HG = 16        // horizontal-layout gap between children

/* ── ComponentChip ── */

interface ChipProps {
  node: TreeNode
  onOpen: (c: Component) => void
  collapsed?: boolean
  onToggle?: () => void
  stageStyle: typeof STAGE_STYLES[0]
  stageNum: number
}

function ComponentChip({ node, onOpen, collapsed, onToggle, stageStyle, stageNum }: ChipProps) {
  const c = node.component
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div
      className={`
        group inline-flex flex-col gap-1.5 border rounded-xl px-3 py-2.5 cursor-pointer
        shadow-sm hover:shadow-md transition-all
        ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}
      `}
      style={{ width: 200 }}
      onClick={() => onOpen(c)}
    >
      <div className="flex items-start gap-2.5">
        {c.image_url ? (
          <img
            src={`${API_BASE}${c.image_url}`} alt={c.name}
            className="h-10 w-10 object-contain rounded shrink-0 mt-0.5"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
            <ImageIcon className="h-5 w-5 opacity-40" />
          </div>
        )}
        <span className="text-xs font-semibold leading-snug flex-1 line-clamp-3" title={c.name}>
          {c.name}
        </span>
        {hasChildren && onToggle && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggle() }}
            className="shrink-0 h-5 w-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors mt-0.5"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pl-[52px]">
        {node.quantity !== 1 && (
          <span className="text-[10px] opacity-50">×{node.quantity}</span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          {c.link_1688 && (
            <a href={c.link_1688} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} className="p-0.5 opacity-60 hover:opacity-100">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {c.regulation_url && (
            <a href={c.regulation_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} className="p-0.5 opacity-60 hover:opacity-100">
              <BookOpen className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 pl-[52px]">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${stageStyle.badge}`}>
          {'①②③④⑤⑥⑦⑧⑨⑩'[stageNum - 1] ?? stageNum}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stageStyle.badge}`}>
          {CATEGORY_LABELS[c.category] ?? c.category}
        </span>
      </div>
    </div>
  )
}

/* ── OrgNode ── */

interface NodeProps {
  node: TreeNode
  onOpen: (c: Component) => void
  depth: number
  maxDepth: number
  defaultCollapsed?: boolean
}

function OrgNode({ node, onOpen, depth, maxDepth, defaultCollapsed = false }: NodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const hasChildren = (node.children?.length ?? 0) > 0
  const style = getStageStyle(depth, maxDepth)
  const stageNum = getStageNumber(depth, maxDepth)

  const childCount = node.children?.length ?? 0
  const useHorizontal = hasChildren && childCount < 5

  return (
    <div className="flex flex-col items-start">
      <ComponentChip
        node={node}
        onOpen={onOpen}
        collapsed={isCollapsed}
        onToggle={hasChildren ? () => setIsCollapsed(v => !v) : undefined}
        stageStyle={style}
        stageNum={stageNum}
      />

      {hasChildren && !isCollapsed && (
        useHorizontal
          ? <HorizontalChildren node={node} depth={depth} maxDepth={maxDepth} onOpen={onOpen} />
          : <VerticalChildren node={node} depth={depth} maxDepth={maxDepth} onOpen={onOpen} />
      )}

      {hasChildren && isCollapsed && (
        <div className="ml-5 mt-1 flex items-center gap-1">
          <div style={{ height: 12, borderLeft: `${LW}px dashed ${LC}` }} />
          <span className="text-[10px] text-gray-400 select-none ml-1">
            {node.children!.length} эл.
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Vertical children (Reddit-style ├── / └──) ── */

interface ChildrenProps {
  node: TreeNode; depth: number; maxDepth: number; onOpen: (c: Component) => void
}

function VerticalChildren({ node, depth, maxDepth, onOpen }: ChildrenProps) {
  const children = node.children!
  return (
    <div className="flex flex-col" style={{ marginLeft: 20 }}>
      {/* Stem from parent to first child */}
      <div style={{ height: 10, borderLeft: `${LW}px solid ${LC}` }} />
      {children.map((child, i) => {
        const isLast = i === children.length - 1
        const collapse = child.component.is_composite && SOLUTION_RE.test(child.component.name)
        return (
          <div
            key={`${child.component.id}-${i}`}
            className="relative"
            style={{ paddingLeft: VI, paddingBottom: isLast ? 0 : 8 }}
          >
            {isLast ? (
              <div
                className="absolute left-0 top-0 pointer-events-none"
                style={{
                  width: VI,
                  height: CHIP_MID,
                  borderLeft: `${LW}px solid ${LC}`,
                  borderBottom: `${LW}px solid ${LC}`,
                  borderBottomLeftRadius: 10,
                }}
              />
            ) : (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 pointer-events-none"
                  style={{ borderLeft: `${LW}px solid ${LC}` }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{ left: 0, top: CHIP_MID, width: VI, borderTop: `${LW}px solid ${LC}` }}
                />
              </>
            )}
            <OrgNode
              node={child} onOpen={onOpen}
              depth={depth + 1} maxDepth={maxDepth}
              defaultCollapsed={collapse}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── Horizontal children (bracket ┬ connector) ── */

function HorizontalChildren({ node, depth, maxDepth, onOpen }: ChildrenProps) {
  const children = node.children!
  return (
    <div className="flex flex-col items-start" style={{ marginLeft: 20 }}>
      {/* Vertical stem from parent */}
      <div style={{ height: HS, borderLeft: `${LW}px solid ${LC}` }} />

      {/* Children in a row */}
      <div className="flex items-start">
        {children.map((child, i) => {
          const isLast = i === children.length - 1
          const collapse = child.component.is_composite && SOLUTION_RE.test(child.component.name)
          return (
            <div
              key={`${child.component.id}-${i}`}
              className="relative flex flex-col items-start"
              style={{ marginRight: isLast ? 0 : HG }}
            >
              {/* Connector: vertical drop + horizontal rail to next sibling */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: 0,
                  left: 0,
                  right: isLast ? 'auto' : -HG,
                  height: HD,
                  display: 'flex',
                }}
              >
                <div style={{ width: 0, flexShrink: 0, height: '100%', borderLeft: `${LW}px solid ${LC}` }} />
                {!isLast && <div style={{ flex: 1, borderTop: `${LW}px solid ${LC}` }} />}
              </div>
              {/* Spacer for the absolute connector */}
              <div style={{ height: HD }} />
              <OrgNode
                node={child} onOpen={onOpen}
                depth={depth + 1} maxDepth={maxDepth}
                defaultCollapsed={collapse}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Root ── */

interface Props {
  kitComponents: KitComponent[]
  onOpenComponent: (c: Component) => void
}

export default function AssemblyTree({ kitComponents, onOpenComponent }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buildFullTree(kitComponents).then(nodes => {
      setTree(nodes)
      setLoading(false)
    })
  }, [kitComponents])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 w-52 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!tree.length) {
    return <div className="text-center py-16 text-gray-400">В наборе нет компонентов</div>
  }

  const maxDepth = getMaxDepth(tree)

  return (
    <div className="overflow-auto pb-6 max-h-[75vh]">
      <div className="inline-flex flex-col items-start gap-4 py-4 px-4 min-w-max">
        {tree.map((node, i) => {
          const collapse = node.component.is_composite && SOLUTION_RE.test(node.component.name)
          return (
            <OrgNode
              key={`${node.component.id}-${i}`}
              node={node}
              onOpen={onOpenComponent}
              depth={0}
              maxDepth={maxDepth}
              defaultCollapsed={collapse}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-gray-100 px-4">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Стадии:</span>
        {STAGE_STYLES.slice().reverse().map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded-sm border ${s.bg} ${s.border}`} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Tree builder ── */

async function buildFullTree(kitComponents: KitComponent[]): Promise<TreeNode[]> {
  // Sequential to avoid Supabase connection pool exhaustion on Vercel serverless
  const nodes: TreeNode[] = []
  for (const kc of kitComponents) {
    nodes.push(await buildNode(kc.component, kc.quantity))
  }
  return nodes
}

async function buildNode(component: Component, quantity: number): Promise<TreeNode> {
  if (!component.is_composite) return { component, quantity }
  let parts: ComponentPart[] = []
  try { parts = await componentsApi.getParts(component.id) } catch (e) { console.error(e) }
  const children: TreeNode[] = []
  for (const p of parts) {
    children.push(await buildNode(p.part, Number(p.quantity)))
  }
  return { component, quantity, children }
}
