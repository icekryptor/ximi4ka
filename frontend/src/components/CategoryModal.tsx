import { useState } from 'react'
import { X } from 'lucide-react'
import { Category, TransactionType } from '../api/types'
import { categoriesApi } from '../api/categories'

interface CategoryModalProps {
  category: Category | null
  onClose: () => void
}

const CategoryModal = ({ category, onClose }: CategoryModalProps) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || TransactionType.EXPENSE,
    color: category?.color || '#0ea5e9',
    description: category?.description || '',
    is_active: category?.is_active !== undefined ? category.is_active : true
  })
  const [saving, setSaving] = useState(false)

  const colorOptions = [
    { value: '#0ea5e9', label: 'Синий' },
    { value: '#10b981', label: 'Зелёный' },
    { value: '#f59e0b', label: 'Оранжевый' },
    { value: '#ef4444', label: 'Красный' },
    { value: '#8b5cf6', label: 'Фиолетовый' },
    { value: '#ec4899', label: 'Розовый' },
    { value: '#14b8a6', label: 'Бирюзовый' },
    { value: '#f97316', label: 'Апельсиновый' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name) {
      alert('Пожалуйста, укажите название категории')
      return
    }

    setSaving(true)
    try {
      if (category) {
        await categoriesApi.update(category.id, formData)
      } else {
        await categoriesApi.create(formData)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения категории:', error)
      alert('Не удалось сохранить категорию')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Редактировать категорию' : 'Новая категория'}
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
              placeholder="Например: Продажа наборов"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Тип транзакции *</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={TransactionType.INCOME}
                  checked={formData.type === TransactionType.INCOME}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Доход</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={TransactionType.EXPENSE}
                  checked={formData.type === TransactionType.EXPENSE}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Расход</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">Цвет</label>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((colorOption) => (
                <button
                  key={colorOption.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: colorOption.value })}
                  className={`h-12 rounded-lg transition-all ${
                    formData.color === colorOption.value
                      ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: colorOption.value }}
                  title={colorOption.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Описание</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Дополнительное описание категории..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              <span className="text-sm font-medium text-gray-700">Активна</span>
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
              {saving ? 'Сохранение...' : category ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CategoryModal
