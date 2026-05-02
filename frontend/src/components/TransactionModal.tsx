import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Transaction, Category, Counterparty, TransactionType } from '../api/types'
import { transactionsApi } from '../api/transactions'
import { useToast } from '../contexts/ToastContext'

interface TransactionModalProps {
  transaction: Transaction | null
  categories: Category[]
  counterparties: Counterparty[]
  onClose: () => void
}

const TransactionModal = ({ transaction, categories, counterparties, onClose }: TransactionModalProps) => {
  const toast = useToast()
  const [formData, setFormData] = useState({
    type: transaction?.type || TransactionType.EXPENSE,
    amount: transaction?.amount || 0,
    description: transaction?.description || '',
    date: transaction?.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0],
    category_id: transaction?.category_id || '',
    counterparty_id: transaction?.counterparty_id || '',
    document_number: transaction?.document_number || '',
    notes: transaction?.notes || ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.description || !formData.amount) {
      toast.warning('Пожалуйста, заполните обязательные поля')
      return
    }

    setSaving(true)
    try {
      if (transaction) {
        await transactionsApi.update(transaction.id, formData)
      } else {
        await transactionsApi.create(formData)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения транзакции:', error)
      toast.error('Не удалось сохранить транзакцию')
    } finally {
      setSaving(false)
    }
  }

  const incomeCategories = categories.filter(c => c.type === TransactionType.INCOME && c.is_active)
  const expenseCategories = categories.filter(c => c.type === TransactionType.EXPENSE && c.is_active)
  const relevantCategories = formData.type === TransactionType.INCOME ? incomeCategories : expenseCategories

  // Portal to <body> — bypasses any ancestor with transform/filter/will-change/contain
  // that would otherwise turn into a containing block for `position: fixed` and pull
  // this modal off-screen. See commit 26b893d for the related .page-enter fix.
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-2xl font-bold text-brand-text">
            {transaction ? 'Редактировать транзакцию' : 'Новая транзакция'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Тип транзакции *</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={TransactionType.INCOME}
                  checked={formData.type === TransactionType.INCOME}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType, category_id: '' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-brand-text-secondary">Доход</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={TransactionType.EXPENSE}
                  checked={formData.type === TransactionType.EXPENSE}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType, category_id: '' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-brand-text-secondary">Расход</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Сумма *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </div>

            <div>
              <label className="label">Дата *</label>
              <input
                type="date"
                required
                className="input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Описание *</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Например: Продажа набора Юный химик"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Категория</label>
              <select
                className="input"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">Без категории</option>
                {relevantCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Контрагент</label>
              <select
                className="input"
                value={formData.counterparty_id}
                onChange={(e) => setFormData({ ...formData, counterparty_id: e.target.value })}
              >
                <option value="">Без контрагента</option>
                {counterparties.filter(c => c.is_active).map((counterparty) => (
                  <option key={counterparty.id} value={counterparty.id}>
                    {counterparty.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Номер документа</label>
            <input
              type="text"
              className="input"
              placeholder="Например: Счет №123"
              value={formData.document_number}
              onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
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

          <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border">
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
              {saving ? 'Сохранение...' : transaction ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default TransactionModal
