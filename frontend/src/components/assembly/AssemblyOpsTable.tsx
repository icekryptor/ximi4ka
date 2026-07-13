import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AssemblyOpListItem, assemblyApi, fmtRub } from '../../api/assembly'
import { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'

/**
 * Массовый ввод нормативов: все операции одной таблицей, сгруппированы по этапам.
 * Норматив (сек) правится инлайн (сохранение по blur/Enter), регламент — селектом.
 * Работа ₽ = сек/3600 × ставка — та же формула, что в дереве.
 */

const STAGE_TITLES: Record<number, string> = {
  1: 'Розлив растворов',
  2: 'Закупорка и проклейка',
  3: 'Фасовка твёрдых веществ',
  4: 'Наполнение ложементов флаконами',
  5: 'Наполнение ложементов пробирками',
  6: 'Наполнение коробочек',
  7: 'Сборка коробки (дно)',
  8: 'Вкладывание методичек и листовок',
  9: 'Закрытие крышкой',
  10: 'Упаковка в защитный короб',
}

export const AssemblyOpsTable = ({ laborRate, kbDocs, onChanged }: {
  laborRate: number
  kbDocs: BrandDoc[]
  onChanged: () => void
}) => {
  const toast = useToast()
  const [ops, setOps] = useState<AssemblyOpListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await assemblyApi.listOperations()
      setOps(r.operations)
      setDrafts(Object.fromEntries(r.operations.map((o) => [o.id, o.timeSeconds == null ? '' : String(o.timeSeconds)])))
    } catch {
      toast.error('Не удалось загрузить операции')
    } finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  const byStage = useMemo(() => {
    const m = new Map<number, AssemblyOpListItem[]>()
    for (const o of ops) {
      if (!m.has(o.stage)) m.set(o.stage, [])
      m.get(o.stage)!.push(o)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [ops])

  const saveTime = async (op: AssemblyOpListItem) => {
    const raw = (drafts[op.id] ?? '').trim()
    const val = raw === '' ? null : Number(raw)
    if (val !== null && (!Number.isFinite(val) || val < 0)) {
      toast.error('Норматив — неотрицательное число секунд')
      setDrafts((d) => ({ ...d, [op.id]: op.timeSeconds == null ? '' : String(op.timeSeconds) }))
      return
    }
    if (val === op.timeSeconds) return
    try {
      await assemblyApi.updateOperation(op.id, { time_seconds: val })
      setOps((prev) => prev.map((o) => (o.id === op.id
        ? { ...o, timeSeconds: val, laborCost: val ? Math.round((val / 3600) * laborRate * 100) / 100 : 0 }
        : o)))
      onChanged()
    } catch {
      toast.error('Не удалось сохранить норматив')
    }
  }

  const saveSlug = async (op: AssemblyOpListItem, slug: string) => {
    try {
      await assemblyApi.updateOperation(op.id, { instruction_slug: slug || null })
      setOps((prev) => prev.map((o) => (o.id === op.id ? { ...o, instructionSlug: slug || null } : o)))
      onChanged()
    } catch {
      toast.error('Не удалось привязать регламент')
    }
  }

  const totalWork = useMemo(() => ops.reduce((s, o) => s + (o.laborCost || 0), 0), [ops])
  const missing = useMemo(() => ops.filter((o) => o.timeSeconds == null).length, [ops])

  if (loading) {
    return <div className="space-y-3"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-5/6" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-brand-text-secondary">
        <span>Операций: <b className="text-brand-text">{ops.length}</b></span>
        <span>Работа всего: <b className="text-brand-text">{fmtRub(totalWork)} ₽</b> (по {fmtRub(laborRate)} ₽/ч)</span>
        {missing > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> без норматива: {missing}
          </span>
        )}
      </div>

      {byStage.map(([stage, list]) => (
        <div key={stage}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">Этап {stage}</span>
            <span className="text-sm font-semibold text-brand-text">{STAGE_TITLES[stage] || ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs text-brand-text-secondary">
                  <th className="py-1.5 pr-3 font-semibold">Узел (результат)</th>
                  <th className="py-1.5 pr-3 font-semibold">Операция</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Норматив, сек</th>
                  <th className="py-1.5 pr-3 font-semibold text-right">Работа, ₽</th>
                  <th className="py-1.5 font-semibold">Регламент</th>
                </tr>
              </thead>
              <tbody>
                {list.map((op) => (
                  <tr key={op.id} className="border-b border-brand-border/40">
                    <td className="max-w-[320px] truncate py-1 pr-3 text-brand-text" title={op.compositeName}>{op.compositeName}</td>
                    <td className="py-1 pr-3 text-brand-text-secondary">{op.name}</td>
                    <td className="py-1 pr-3 text-right">
                      <input
                        className={`input w-24 !py-1 text-right tabular-nums ${op.timeSeconds == null ? 'border-amber-400' : ''}`}
                        inputMode="numeric"
                        value={drafts[op.id] ?? ''}
                        placeholder="—"
                        onChange={(e) => setDrafts((d) => ({ ...d, [op.id]: e.target.value.replace(/[^\d]/g, '') }))}
                        onBlur={() => saveTime(op)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums text-brand-text">{fmtRub(op.laborCost)}</td>
                    <td className="py-1">
                      <select
                        className="input !py-1 w-64"
                        value={op.instructionSlug ?? ''}
                        onChange={(e) => saveSlug(op, e.target.value)}
                      >
                        <option value="">— без регламента —</option>
                        {kbDocs.map((d) => (
                          <option key={d.slug} value={d.slug}>{d.title}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
