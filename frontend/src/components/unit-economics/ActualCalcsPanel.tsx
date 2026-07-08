import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, CheckCircle2 } from 'lucide-react'
import { unitEconomicsApi, UnitEconomicsCalculation } from '../../api/unitEconomics'
import { useToast } from '../../contexts/ToastContext'

/**
 * Панель «Актуальные расчёты» — источник истины для планирования/аналитики.
 * Один расчёт на канал помечается актуальным (is_current). Остальные — гипотетические.
 */
export const ActualCalcsPanel = ({ kitId }: { kitId: string | null }) => {
  const toast = useToast()
  const [calcs, setCalcs] = useState<UnitEconomicsCalculation[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!kitId) { setCalcs([]); return }
    setLoading(true)
    try {
      setCalcs(await unitEconomicsApi.getAll(kitId))
    } catch {
      /* тихо */
    } finally { setLoading(false) }
  }, [kitId])
  useEffect(() => { load() }, [load])

  const byChannel = useMemo(() => {
    const m = new Map<string, UnitEconomicsCalculation[]>()
    for (const c of calcs) {
      if (!m.has(c.channel_name)) m.set(c.channel_name, [])
      m.get(c.channel_name)!.push(c)
    }
    // внутри канала: актуальный сверху, затем по дате
    for (const arr of m.values())
      arr.sort((a, b) => (Number(b.is_current) - Number(a.is_current)) || b.updated_at.localeCompare(a.updated_at))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [calcs])

  const mark = async (id: string) => {
    setBusy(id)
    try {
      await unitEconomicsApi.setCurrent(id)
      toast.success('Отмечен как актуальный')
      await load()
    } catch (e: any) {
      toast.error('Ошибка: ' + (e.response?.data?.error || e.message))
    } finally { setBusy(null) }
  }

  if (!kitId) return null

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-primary-500" />
        <h2 className="text-sm font-semibold text-brand-text">Актуальные расчёты</h2>
        <span className="text-xs text-brand-text-secondary">— источник данных для планирования и аналитики (по одному на канал)</span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-brand-text-secondary">Загрузка…</div>
      ) : byChannel.length === 0 ? (
        <div className="py-6 text-center text-sm text-brand-text-secondary">
          Для этого набора ещё нет сохранённых расчётов. Настрой и сохрани сценарий выше — затем отметь актуальный.
        </div>
      ) : (
        <div className="space-y-3">
          {byChannel.map(([channel, list]) => (
            <div key={channel}>
              <div className="mb-1 text-xs font-semibold text-brand-text-secondary">{channel}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id} className={`border-b border-brand-border/40 ${c.is_current ? 'bg-green-50/60' : ''}`}>
                        <td className="py-1.5 pr-3 w-8">
                          {c.is_current && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </td>
                        <td className="py-1.5 pr-4">
                          <span className="text-brand-text">{c.name}</span>
                          <span className="ml-2 text-[11px] text-brand-text-secondary/70">{new Date(c.updated_at).toLocaleDateString('ru-RU')}</span>
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">маржа {Number(c.margin).toFixed(1)}%</td>
                        <td className="py-1.5 text-right">
                          {c.is_current ? (
                            <span className="text-xs font-medium text-green-700">актуальный</span>
                          ) : (
                            <button onClick={() => mark(c.id)} disabled={busy === c.id}
                              className="rounded-lg border border-brand-border px-2.5 py-1 text-xs text-brand-text-secondary hover:border-primary-300 hover:text-primary-700 disabled:opacity-50">
                              {busy === c.id ? '…' : 'Сделать актуальным'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
