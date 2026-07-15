import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { AssemblyNode, AssemblyNodeOperation, assemblyApi, fmtRub } from '../../api/assembly'
import { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'

/**
 * Правая панель узла: себестоимость (материалы/работа/итого), операции
 * с инлайн-редактором норматива (optimistic + refetch дерева), привязка
 * регламента (kb-* доки из brand_docs), состав с ценами.
 */

interface AssemblyNodeCardProps {
  node: AssemblyNode
  laborRate: number
  kbDocs: BrandDoc[]
  onChanged: () => Promise<void> | void
  onSelectNode?: (id: string) => void
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const AssemblyNodeCard = ({ node, laborRate, kbDocs, onChanged, onSelectNode }: AssemblyNodeCardProps) => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()

  // Локальная копия операций для optimistic-обновлений (пересинк при refetch дерева)
  const [ops, setOps] = useState<AssemblyNodeOperation[]>(node.operations)
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({})

  // Форма новой операции
  const [showNewOp, setShowNewOp] = useState(false)
  const [newOpName, setNewOpName] = useState('')
  const [newOpStage, setNewOpStage] = useState('')
  const [savingNewOp, setSavingNewOp] = useState(false)

  useEffect(() => {
    setOps(node.operations)
    setTimeDrafts({})
  }, [node])

  const commitTime = async (op: AssemblyNodeOperation) => {
    const draft = timeDrafts[op.id]
    if (draft === undefined) return
    const trimmed = draft.trim()
    const nextTime = trimmed === '' ? null : Number(trimmed)
    if (nextTime !== null && (!Number.isFinite(nextTime) || nextTime < 0)) {
      toast.error('Норматив — неотрицательное число секунд')
      setTimeDrafts((d) => ({ ...d, [op.id]: op.timeSeconds == null ? '' : String(op.timeSeconds) }))
      return
    }
    if (nextTime === op.timeSeconds) {
      setTimeDrafts((d) => {
        const next = { ...d }
        delete next[op.id]
        return next
      })
      return
    }
    // Optimistic: сразу пересчитываем стоимость работы локально
    setOps((prev) =>
      prev.map((o) =>
        o.id === op.id
          ? { ...o, timeSeconds: nextTime, laborCost: nextTime ? round2((nextTime / 3600) * laborRate) : 0 }
          : o
      )
    )
    try {
      await assemblyApi.updateOperation(op.id, { time_seconds: nextTime })
      await onChanged()
    } catch {
      toast.error('Не удалось сохранить норматив')
      setOps(node.operations)
      setTimeDrafts({})
    }
  }

  const bindInstruction = async (op: AssemblyNodeOperation, slug: string) => {
    const nextSlug = slug || null
    setOps((prev) => prev.map((o) => (o.id === op.id ? { ...o, instructionSlug: nextSlug } : o)))
    try {
      await assemblyApi.updateOperation(op.id, { instruction_slug: nextSlug })
      await onChanged()
    } catch {
      toast.error('Не удалось привязать регламент')
      setOps(node.operations)
    }
  }

  const removeOperation = async (op: AssemblyNodeOperation) => {
    const ok = await confirm({
      title: 'Удалить операцию?',
      message: `Операция «${op.name}» будет удалена вместе с нормативом.`,
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await assemblyApi.deleteOperation(op.id)
      setOps((prev) => prev.filter((o) => o.id !== op.id))
      await onChanged()
    } catch {
      toast.error('Не удалось удалить операцию')
    }
  }

  const addOperation = async () => {
    const name = newOpName.trim()
    if (!name) {
      toast.error('Укажите название операции')
      return
    }
    const stage = newOpStage.trim() === '' ? 0 : Number(newOpStage)
    if (!Number.isFinite(stage) || stage < 0) {
      toast.error('Этап — неотрицательное число')
      return
    }
    try {
      setSavingNewOp(true)
      await assemblyApi.createOperation({
        composite_id: node.id,
        name,
        stage,
        sort_order: ops.length + 1,
      })
      setNewOpName('')
      setNewOpStage('')
      setShowNewOp(false)
      await onChanged()
    } catch {
      toast.error('Не удалось создать операцию')
    } finally {
      setSavingNewOp(false)
    }
  }

  const materialTotal = node.materialCost
  const laborTotal = ops.reduce((s, o) => s + o.laborCost, 0) * node.quantity

  return (
    <div className="card space-y-5 p-5">
      {/* Заголовок */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-text" title={node.name}>{node.name}</h2>
          {node.stageMax > 0 && (
            <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
              Этап {node.stageMax}
            </span>
          )}
        </div>
        {node.quantity !== 1 && (
          <p className="mt-0.5 text-sm text-brand-text-secondary">Количество в родителе: ×{node.quantity}</p>
        )}
      </div>

      {/* Себестоимость */}
      <div className="rounded-xl bg-muted p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-brand-text-secondary">Материалы</span>
          <span className="font-medium text-brand-text">{fmtRub(materialTotal)} ₽</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-brand-text-secondary">Работа (узел)</span>
          <span className="font-medium text-brand-text">{fmtRub(laborTotal)} ₽</span>
        </div>
        {node.laborCumulative > laborTotal + 0.001 && (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-brand-text-secondary" title="Работа этого узла плюс вся работа вложенных узлов">
              Суммарная работа
            </span>
            <span className="font-medium text-primary-700">{fmtRub(node.laborCumulative)} ₽</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2">
          <span className="text-sm font-semibold text-brand-text">Итого</span>
          <span className="font-bold text-brand-text">{fmtRub(materialTotal + laborTotal)} ₽</span>
        </div>
      </div>

      {/* Операции */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-text">Операции</h3>
          <button
            onClick={() => setShowNewOp((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Операция
          </button>
        </div>

        {ops.length === 0 && !showNewOp && (
          <p className="text-sm text-brand-text-secondary">
            {node.isComposite ? 'Операции не заданы' : 'Закупаемый компонент — операций нет'}
          </p>
        )}

        <div className="space-y-3">
          {ops.map((op) => {
            const boundDoc = op.instructionSlug ? kbDocs.find((d) => d.slug === op.instructionSlug) : undefined
            const draft = timeDrafts[op.id]
            return (
              <div key={op.id} className="rounded-xl border border-brand-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-brand-text" title={op.name}>{op.name}</span>
                    <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                      Этап {op.stage}
                    </span>
                  </div>
                  <button
                    onClick={() => removeOperation(op)}
                    className="shrink-0 text-brand-text-secondary transition-colors hover:text-red-600"
                    title="Удалить операцию"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-brand-text-secondary">Норматив, сек</label>
                  <input
                    type="number"
                    min={0}
                    className="input w-24 px-2 py-1 text-sm"
                    placeholder="—"
                    value={draft !== undefined ? draft : op.timeSeconds == null ? '' : String(op.timeSeconds)}
                    onChange={(e) => setTimeDrafts((d) => ({ ...d, [op.id]: e.target.value }))}
                    onBlur={() => commitTime(op)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                  />
                  {op.timeSeconds == null && draft === undefined ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> норматив не заполнен
                    </span>
                  ) : (
                    <span className="text-xs text-brand-text-secondary">
                      работа <span className="font-medium text-brand-text">{fmtRub(op.laborCost)} ₽</span>
                    </span>
                  )}
                </div>

                {/* Регламент */}
                <div className="mt-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 shrink-0 text-brand-text-secondary" />
                  <select
                    className="input min-w-0 flex-1 px-2 py-1 text-sm"
                    value={op.instructionSlug ?? ''}
                    onChange={(e) => bindInstruction(op, e.target.value)}
                  >
                    <option value="">— без регламента —</option>
                    {kbDocs.map((d) => (
                      <option key={d.slug} value={d.slug}>{d.title}</option>
                    ))}
                    {op.instructionSlug && !boundDoc && (
                      <option value={op.instructionSlug}>{op.instructionSlug} (не найден)</option>
                    )}
                  </select>
                  {op.instructionSlug && boundDoc && (
                    <Link
                      to={`/production/knowledge-base?doc=${op.instructionSlug}`}
                      className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
                      title="Открыть регламент"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Открыть
                    </Link>
                  )}
                </div>
                {op.instructionSlug && !boundDoc && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Регламент не найден —{' '}
                    <Link to="/production/knowledge-base" className="font-medium text-primary-600 hover:text-primary-700">
                      база знаний
                    </Link>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Новая операция */}
        {showNewOp && (
          <div className="mt-3 rounded-xl border border-dashed border-primary-300 p-3">
            <div className="flex items-center gap-2">
              <input
                className="input min-w-0 flex-1 px-2 py-1 text-sm"
                placeholder="Название операции"
                value={newOpName}
                onChange={(e) => setNewOpName(e.target.value)}
                autoFocus
              />
              <input
                type="number"
                min={0}
                className="input w-20 px-2 py-1 text-sm"
                placeholder="Этап"
                title="Этап (1–10)"
                value={newOpStage}
                onChange={(e) => setNewOpStage(e.target.value)}
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setShowNewOp(false)} className="btn btn-secondary px-3 py-1 text-sm">
                Отмена
              </button>
              <button onClick={addOperation} disabled={savingNewOp} className="btn btn-primary px-3 py-1 text-sm disabled:opacity-60">
                {savingNewOp ? 'Сохранение…' : 'Добавить'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Состав */}
      {node.children.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-text">Состав</h3>
          <div className="space-y-1">
            {node.children.map((child, i) => (
              <div
                key={`${child.id}-${i}`}
                onClick={() => onSelectNode?.(child.id)}
                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  onSelectNode ? 'cursor-pointer transition-colors hover:bg-muted' : ''
                }`}
              >
                <span className="min-w-0 truncate text-brand-text" title={child.name}>
                  {child.name}
                  <span className="ml-1 text-xs text-brand-text-secondary">×{child.quantity}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 font-medium text-brand-text">
                  {!child.isComposite && child.materialCost === 0 && (
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                  )}
                  {fmtRub(child.totalCost)} ₽
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
