import { useState } from 'react'
import { X } from 'lucide-react'
import { Counterparty, CounterpartyType } from '../api/types'
import { counterpartiesApi } from '../api/counterparties'

interface CounterpartyModalProps {
  counterparty: Counterparty | null
  onClose: () => void
}

const CounterpartyModal = ({ counterparty, onClose }: CounterpartyModalProps) => {
  const [formData, setFormData] = useState({
    name: counterparty?.name || '',
    type: counterparty?.type || CounterpartyType.BOTH,
    inn: counterparty?.inn || '',
    address: counterparty?.address || '',
    phone: counterparty?.phone || '',
    email: counterparty?.email || '',
    contact_person: counterparty?.contact_person || '',
    notes: counterparty?.notes || '',
    is_active: counterparty?.is_active !== undefined ? counterparty.is_active : true
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      alert('Пожалуйста, укажите название контрагента')
      return
    }

    setSaving(true)
    try {
      if (counterparty) {
        await counterpartiesApi.update(counterparty.id, formData)
      } else {
        await counterpartiesApi.create(formData)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения контрагента:', error)
      alert('Не удалось сохранить контрагента')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {counterparty ? 'Редактировать контрагента' : 'Новый контрагент'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Название *</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Например: ООО Химснаб"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Тип контрагента *</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CounterpartyType })}
            >
              <option value={CounterpartyType.SUPPLIER}>Поставщик</option>
              <option value={CounterpartyType.CUSTOMER}>Клиент</option>
              <option value={CounterpartyType.BOTH}>Поставщик и клиент</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ИНН</label>
              <input
                type="text"
                className="input"
                placeholder="1234567890"
                value={formData.inn}
                onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Телефон</label>
              <input
                type="tel"
                className="input"
                placeholder="+7 (999) 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="contact@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Контактное лицо</label>
            <input
              type="text"
              className="input"
              placeholder="Иванов Иван Иванович"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Адрес</label>
            <input
              type="text"
              className="input"
              placeholder="г. Москва, ул. Примерная, д. 123"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Заметки</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Дополнительная информация..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Активен</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Сохранение...' : counterparty ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CounterpartyModal
