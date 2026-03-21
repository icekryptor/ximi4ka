import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { kitsApi, Kit } from '../api/kits'

interface Props {
  kit?: Kit
  onClose: () => void
  onSaved: (kitId: string) => void
}

export default function KitModal({ kit, onClose, onSaved }: Props) {
  const isEdit = !!kit

  const [form, setForm] = useState({
    name: kit?.name ?? '',
    sku: kit?.sku ?? '',
    seller_sku: kit?.seller_sku ?? '',
    description: kit?.description ?? '',
    batch_size: kit?.batch_size ?? 1000,
    retail_price: kit?.retail_price ?? '',
    wholesale_price: kit?.wholesale_price ?? '',
    notes: kit?.notes ?? '',
    is_active: kit?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Укажите название набора'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        seller_sku: form.seller_sku || undefined,
        description: form.description || undefined,
        batch_size: form.batch_size,
        retail_price: form.retail_price !== '' ? Number(form.retail_price) : undefined,
        wholesale_price: form.wholesale_price !== '' ? Number(form.wholesale_price) : undefined,
        notes: form.notes || undefined,
        is_active: form.is_active,
      }

      if (isEdit) {
        await kitsApi.update(kit.id, payload)
        onSaved(kit.id)
      } else {
        const created = await kitsApi.create({
          ...payload,
          reagents_cost: 0,
          equipment_cost: 0,
          print_cost: 0,
          labor_cost: 0,
          total_cost: 0,
        })
        onSaved(created.id)
      }
    } catch (e: any) {
      setError(e.response?.data?.error ?? (isEdit ? 'Ошибка сохранения' : 'Ошибка создания'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="modal-panel max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isEdit ? 'Редактировать набор' : 'Новый набор'}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="label">Статус</label>
                    <select
                      className="input"
                      value={form.is_active ? 'active' : 'inactive'}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                    >
                      <option value="active">Активен</option>
                      <option value="inactive">Неактивен</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Розничная цена, ₽</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.retail_price}
                      onChange={e => setForm(f => ({ ...f, retail_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Оптовая цена, ₽</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.wholesale_price}
                      onChange={e => setForm(f => ({ ...f, wholesale_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Заметки</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Дополнительная информация"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={onClose} className="btn btn-secondary">
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
