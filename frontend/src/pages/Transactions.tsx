import { useEffect, useState } from 'react'
import { transactionsApi } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import { counterpartiesApi } from '../api/counterparties'
import { Transaction, Category, Counterparty, TransactionType } from '../api/types'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import TransactionModal from '../components/TransactionModal'

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [transactionsData, categoriesData, counterpartiesData] = await Promise.all([
        transactionsApi.getAll(),
        categoriesApi.getAll(),
        counterpartiesApi.getAll()
      ])
      setTransactions(transactionsData)
      setCategories(categoriesData)
      setCounterparties(counterpartiesData)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту транзакцию?')) {
      return
    }

    try {
      await transactionsApi.delete(id)
      setTransactions(transactions.filter(t => t.id !== id))
    } catch (error) {
      console.error('Ошибка удаления транзакции:', error)
      alert('Не удалось удалить транзакцию')
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingTransaction(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingTransaction(null)
    loadData()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount)
  }

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.counterparty?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || transaction.type === filterType

    return matchesSearch && matchesType
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-gray-600 mt-1">Управление доходами и расходами</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Добавить транзакцию</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по описанию, контрагенту, категории..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              className="input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Все типы</option>
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Транзакции не найдены</p>
            <button onClick={handleAdd} className="btn btn-primary mt-4">
              Добавить первую транзакцию
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Описание</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Категория</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Контрагент</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Сумма</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {transaction.type === TransactionType.INCOME ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Доход
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Расход
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {format(new Date(transaction.date), 'd MMM yyyy', { locale: ru })}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{transaction.description}</p>
                      {transaction.notes && (
                        <p className="text-sm text-gray-500">{transaction.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {transaction.category ? (
                        <span className="inline-flex items-center text-sm">
                          {transaction.category.color && (
                            <span
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: transaction.category.color }}
                            />
                          )}
                          {transaction.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {transaction.counterparty?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-semibold ${
                          transaction.type === TransactionType.INCOME
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {transaction.type === TransactionType.INCOME ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <TransactionModal
          transaction={editingTransaction}
          categories={categories}
          counterparties={counterparties}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

export default Transactions
