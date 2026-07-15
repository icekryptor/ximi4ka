import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, GitMerge, ListChecks } from 'lucide-react'
import {
  AssemblyNode,
  AssemblyRoot,
  AssemblyTreeResponse,
  assemblyApi,
  fmtRub,
} from '../api/assembly'
import { brandDocsApi } from '../api/brandDocs'
import { BrandDoc } from '../api/types'
import { AssemblyTree } from '../components/assembly/AssemblyTree'
import { AssemblyNodeCard } from '../components/assembly/AssemblyNodeCard'
import { AssemblyOpsTable } from '../components/assembly/AssemblyOpsTable'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

// DFS: первый узел с данным component id (компонент может встречаться в нескольких ветках)
const findNode = (node: AssemblyNode | null, id: string): AssemblyNode | null => {
  if (!node) return null
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

const AssemblyScheme = () => {
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [roots, setRoots] = useState<AssemblyRoot[]>([])
  const [rootId, setRootId] = useState('')
  const [treeResp, setTreeResp] = useState<AssemblyTreeResponse | null>(null)
  const [kbDocs, setKbDocs] = useState<BrandDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [laborRate, setLaborRate] = useState(500)
  const [view, setView] = useState<'tree' | 'ops'>('tree')
  const [rateDraft, setRateDraft] = useState('500')

  useEffect(() => {
    const init = async () => {
      try {
        const [rootList, rate, docs] = await Promise.all([
          assemblyApi.roots(),
          assemblyApi.getLaborRate(),
          brandDocsApi.list(),
        ])
        setRoots(rootList)
        setLaborRate(rate)
        setRateDraft(String(rate))
        setKbDocs(docs.filter((d) => d.slug.startsWith('kb-')))
        if (rootList.length > 0) setRootId(rootList[0].id)
      } catch (e) {
        console.error('Ошибка загрузки схемы сборки:', e)
        toast.error('Не удалось загрузить схему сборки')
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTree = useCallback(
    async (id: string, silent = false) => {
      if (!silent) setTreeLoading(true)
      try {
        const resp = await assemblyApi.tree(id)
        setTreeResp(resp)
        setLaborRate(resp.meta.laborRate)
      } catch (e) {
        console.error('Ошибка загрузки дерева сборки:', e)
        toast.error('Не удалось загрузить дерево сборки')
      } finally {
        if (!silent) setTreeLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    if (!rootId) return
    setSelectedId(null)
    loadTree(rootId)
  }, [rootId, loadTree])

  // Refetch после правок операций — без мигания лоадера
  const refetchTree = useCallback(async () => {
    if (rootId) await loadTree(rootId, true)
  }, [rootId, loadTree])

  const saveRate = async () => {
    const next = Number(rateDraft.trim())
    if (!Number.isFinite(next) || next <= 0) {
      toast.error('Ставка — положительное число ₽/час')
      setRateDraft(String(laborRate))
      return
    }
    if (next === laborRate) return
    try {
      const saved = await assemblyApi.setLaborRate(next)
      setLaborRate(saved)
      setRateDraft(String(saved))
      toast.success('Ставка обновлена')
      await refetchTree()
    } catch {
      toast.error('Не удалось сохранить ставку')
      setRateDraft(String(laborRate))
    }
  }

  const selectedNode = useMemo(
    () => (selectedId && treeResp ? findNode(treeResp.tree, selectedId) : null),
    [selectedId, treeResp]
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-1/4" />
          <div className="skeleton h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Заголовок + управление */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-text">Схема сборки</h1>
          <p className="mt-1 text-brand-text-secondary">
            Дерево производства с себестоимостью: материалы + работа. Клик по узлу или линии — операции и состав
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-1 rounded-xl border border-brand-border p-0.5">
            <button onClick={() => setView('tree')}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'tree' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
              <GitMerge className="h-4 w-4" /> Дерево
            </button>
            <button onClick={() => setView('ops')}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === 'ops' ? 'bg-primary-500 text-white' : 'text-brand-text-secondary'}`}>
              <ListChecks className="h-4 w-4" /> Все операции
            </button>
          </div>
          <div>
            <label className="label">Набор</label>
            <select
              className="input w-72"
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
              disabled={roots.length === 0}
            >
              {roots.length === 0 && <option value="">Наборы не найдены</option>}
              {roots.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ставка, ₽/час</label>
            {isAdmin ? (
              <input
                type="number"
                min={1}
                className="input w-28"
                value={rateDraft}
                onChange={(e) => setRateDraft(e.target.value)}
                onBlur={saveRate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            ) : (
              <div className="px-3 py-2 font-medium text-brand-text">{fmtRub(laborRate)} ₽/ч</div>
            )}
          </div>
        </div>
      </div>

      {/* Предупреждения бэкенда (циклы, потерянные компоненты) */}
      {treeResp && treeResp.meta.warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          {treeResp.meta.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {view === 'ops' ? (
        <div className="card p-4">
          <AssemblyOpsTable laborRate={laborRate} kbDocs={kbDocs} onChanged={refetchTree} />
        </div>
      ) : (
      <div className="flex items-stretch gap-6 h-[calc(100vh-14rem)] min-h-[420px]">
        {/* Дерево — скроллится внутри своей области, панель остаётся на месте */}
        <div className="card min-w-0 flex-1 p-4 overflow-y-auto">
          {treeLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-10 w-2/3 ml-auto" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-5/6 ml-auto" />
            </div>
          ) : treeResp?.tree ? (
            <AssemblyTree root={treeResp.tree} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <div className="py-12 text-center">
              <GitMerge className="mx-auto mb-4 h-16 w-16 text-brand-text-secondary" />
              <p className="text-lg text-brand-text-secondary">
                {roots.length === 0 ? 'Корневые наборы не найдены' : 'Дерево сборки пусто'}
              </p>
            </div>
          )}
        </div>

        {/* Правая панель — фиксирована рядом с деревом; при высокой карточке скроллится сама */}
        {selectedNode && (
          <div className="w-[380px] shrink-0 overflow-y-auto">
            <AssemblyNodeCard
              key={selectedNode.id}
              node={selectedNode}
              laborRate={laborRate}
              kbDocs={kbDocs}
              onChanged={refetchTree}
              onSelectNode={setSelectedId}
            />
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default AssemblyScheme
