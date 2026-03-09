import { useState } from 'react'
import { X } from 'lucide-react'
import { kitsApi } from '../api/kits'

interface Props {
  onClose: () => void
  onSaved: (kitId: string) => void
}

export default function KitModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    seller_sku: '',
    description: '',
    batch_size: 1000,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Укажите название набора'); return }
    setSaving(true)
    setError('')
    try {
      const kit = await kitsApi.create({
        ...form,
        reagents_cost: 0,
        equipment_cost: 0,
        print_cost: 0,
        labor_cost: 0,
        total_cost: 0,
        is_active: true,
      })
      onSaved(kit.id)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Новый набор</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Название *</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Например: Электрохимичка"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Артикул (SKU)</label>
              <input
                className="input"
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="ECHEM-001"
              />
            </div>
            <div>
              <label className="label">Артикул продавца</label>
              <input
                className="input"
                value={form.seller_sku}
                onChange={e => setForm(f => ({ ...f, seller_sku: e.target.value }))}
                placeholder="7V25"
              />
            </div>
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Краткое описание набора"
            />
          </div>

          <div>
            <label className="label">Размер партии, шт</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.batch_size}
              onChange={e => setForm(f => ({ ...f, batch_size: parseInt(e.target.value) || 1 }))}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
