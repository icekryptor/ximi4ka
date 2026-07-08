import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { mpAnalyticsApi, MpPlanRow } from '../api/mpAnalytics'
import { useToast } from '../contexts/ToastContext'

const money = (v: number | null): string => (v == null ? '—' : `${Math.round(v).toLocaleString('ru-RU')} ₽`)
const pct = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}%`)

const nextMonth = (): string => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 7)
}

type Row = MpPlanRow & { _orders: string; _drrz: string }

const MpPlanning = () => {
  const toast = useToast()
  const [month, setMonth] = useState(nextMonth())
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await mpAnalyticsApi.plan('wb', month)
      setRows(data.map((r) => ({ ...r, _orders: r.orders_sum != null ? String(r.orders_sum) : '', _drrz: r.drrz != null ? String(r.drrz) : '' })))
    } catch {
      toast.error('Не удалось загрузить план')
    } finally { setLoading(false) }
  }, [month, toast])
  useEffect(() => { load() }, [load])

  const setField = (sku: string, field: '_orders' | '_drrz', val: string) =>
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, [field]: val } : r)))

  const save = async (r: Row) => {
    const orders = r._orders === '' ? null : Number(r._orders)
    const drrz = r._drrz === '' ? null : Number(r._drrz)
    try {
      await mpAnalyticsApi.planSave('wb', r.sku, month, orders, drrz)
    } catch (e: any) {
      toast.error('Ошибка сохранения: ' + (e.response?.data?.error || e.message))
    }
  }

  // расчёты
  const calc = (r: Row) => {
    const orders = r._orders === '' ? null : Number(r._orders)
    const drrz = r._drrz === '' ? null : Number(r._drrz)
    const budget = orders != null && drrz != null ? (orders * drrz) / 100 : null
    const profit = orders != null && r.margin != null ? (orders * r.margin) / 100 : null
    return { orders, drrz, budget, profit }
  }

  const totals = useMemo(() => {
    let orders = 0, budget = 0, profit = 0
    for (const r of rows) {
      const c = calc(r)
      orders += c.orders ?? 0
      budget += c.budget ?? 0
      profit += c.profit ?? 0
    }
    return { orders, budget, profit }
  }, [rows])

  const inputCls = 'w-28 rounded-lg border border-brand-border bg-card px-2 py-1 text-right text-sm tabular-nums focus:border-primary-400 focus:outline-none'

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <CalendarRange className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-brand-text">Планирование продвижения</h1>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm border border-brand-border bg-card text-brand-text-secondary" />
      </div>

      <div className="text-sm text-brand-text-secondary">
        Задай план на месяц по артикулам: <b>Сумма заказов</b> и <b>ДРРз</b>. Бюджет = сумма×ДРРз; маржа — из
        актуальной юнитки (канал ВБ); чистая прибыль = сумма заказов × маржа.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
      ) : rows.length === 0 ? (
        <div className="card !p-10 text-center text-brand-text-secondary">Артикулов нет — появятся после загрузки рекламы/аналитики.</div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-brand-text-secondary">
                  <th className="py-2 pr-4 font-semibold">Артикул</th>
                  <th className="py-2 pr-4 font-semibold">Товар</th>
                  <th className="py-2 pr-4 font-semibold text-right">Сумма заказов</th>
                  <th className="py-2 pr-4 font-semibold text-right">ДРРз, %</th>
                  <th className="py-2 pr-4 font-semibold text-right">Реклам. бюджет</th>
                  <th className="py-2 pr-4 font-semibold text-right">Маржа</th>
                  <th className="py-2 font-semibold text-right">Чистая прибыль</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = calc(r)
                  return (
                    <tr key={r.sku} className="border-b border-brand-border/50">
                      <td className="py-1.5 pr-4 font-mono text-brand-text">{r.seller_article}</td>
                      <td className="py-1.5 pr-4"><span className="block max-w-[220px] truncate text-brand-text-secondary" title={r.product_name}>{r.product_name}</span></td>
                      <td className="py-1.5 pr-4 text-right">
                        <input className={inputCls} inputMode="numeric" value={r._orders}
                          onChange={(e) => setField(r.sku, '_orders', e.target.value.replace(/[^\d.]/g, ''))}
                          onBlur={() => save(r)} placeholder="0" />
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        <input className={`${inputCls} w-16`} inputMode="decimal" value={r._drrz}
                          onChange={(e) => setField(r.sku, '_drrz', e.target.value.replace(/[^\d.]/g, ''))}
                          onBlur={() => save(r)} placeholder="0" />
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text">{money(c.budget)}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-brand-text-secondary">{r.margin == null ? '— нет юнитки' : pct(r.margin)}</td>
                      <td className={`py-1.5 text-right tabular-nums font-semibold ${(c.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(c.profit)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-brand-border font-semibold text-brand-text">
                  <td className="py-2 pr-4" colSpan={2}>Всего</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(totals.orders)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-brand-text-secondary">{totals.orders ? pct((totals.budget / totals.orders) * 100) : '—'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{money(totals.budget)}</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 text-right tabular-nums">{money(totals.profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-brand-text-secondary/70">Значения сохраняются автоматически при уходе из поля. «— нет юнитки»: для артикула не найден актуальный расчёт по каналу ВБ.</p>
        </div>
      )}
    </div>
  )
}

export default MpPlanning
