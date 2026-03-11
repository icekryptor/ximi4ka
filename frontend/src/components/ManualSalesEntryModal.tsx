import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Kit } from '../api/kits'
import { salesReportApi, CHANNEL_OPTIONS, ManualSalesInput } from '../api/salesReport'

interface Props {
  kits: Kit[]
  onClose: () => void
  onSaved: () => void
  defaultDate?: string
  defaultChannel?: string
  defaultKitId?: string
}

export default function ManualSalesEntryModal({
  kits,
  onClose,
  onSaved,
  defaultDate,
  defaultChannel,
  defaultKitId,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<ManualSalesInput>({
    date: defaultDate || today,
    channel_name: defaultChannel || 'Сайт',
    kit_id: defaultKitId || '',
    sales_count: 0,
    revenue_per_unit: 0,
    logistics_cost: 0,
    storage_cost: 0,
    ad_spend: 0,
    other_costs: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!form.kit_id && kits.length > 0) {
      setForm(f => ({ ...f, kit_id: kits[0].id }))
    }
  }, [kits])

  // Computed
  const totalRevenue = form.sales_count * form.revenue_per_unit
  const selectedKit = kits.find(k => k.id === form.kit_id)
  const costPrice = selectedKit?.estimated_cost || selectedKit?.total_cost || 0
  const totalCosts = (costPrice * form.sales_count)
    + form.logistics_cost + form.storage_cost + form.ad_spend + form.other_costs
  const profit = totalRevenue - totalCosts
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.kit_id) { setError('Выберите артикул'); return }
    if (form.sales_count <= 0) { setError('Укажите количество продаж'); return }

    setSaving(true)
    setError('')
    try {
      await salesReportApi.createOrUpdate(form)
      onSaved()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Добавить запись о продажах</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date + Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Канал</label>
              <select
                className="input"
                value={form.channel_name}
                onChange={e => setForm(f => ({ ...f, channel_name: e.target.value }))}
              >
                {CHANNEL_OPTIONS.filter(c => c !== 'ВБ').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Kit */}
          <div>
            <label className="label">Артикул</label>
            <select
              className="input"
              value={form.kit_id}
              onChange={e => setForm(f => ({ ...f, kit_id: e.target.value }))}
            >
              <option value="">Выберите...</option>
              {kits.map(k => (
                <option key={k.id} value={k.id}>
                  {k.seller_sku ? `${k.seller_sku} — ` : ''}{k.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sales data */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Количество продаж</label>
              <input
                type="number"
                className="input"
                min="0"
                value={form.sales_count || ''}
                onChange={e => setForm(f => ({ ...f, sales_count: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="label">Доход за единицу (₽)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.revenue_per_unit || ''}
                onChange={e => setForm(f => ({ ...f, revenue_per_unit: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Логистика (₽)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.logistics_cost || ''}
                onChange={e => setForm(f => ({ ...f, logistics_cost: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="label">Хранение (₽)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.storage_cost || ''}
                onChange={e => setForm(f => ({ ...f, storage_cost: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Реклама (₽)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.ad_spend || ''}
                onChange={e => setForm(f => ({ ...f, ad_spend: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="label">Прочие расходы (₽)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.other_costs || ''}
                onChange={e => setForm(f => ({ ...f, other_costs: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Calculated preview */}
          {form.sales_count > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Общий доход</span>
                <span className="font-medium">{fmt(totalRevenue)} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Себестоимость ({form.sales_count} × {fmt(costPrice)})</span>
                <span className="text-gray-600">{fmt(costPrice * form.sales_count)} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Общие расходы</span>
                <span className="text-gray-600">{fmt(totalCosts)} ₽</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-medium">Прибыль</span>
                <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(profit)} ₽ ({margin.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
