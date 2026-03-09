import { useEffect, useState, useCallback } from 'react'
import { transactionsApi, PaginationMeta } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import { counterpartiesApi } from '../api/counterparties'
import { Transaction, Category, Counterparty, TransactionType } from '../api/types'
import { formatCurrency } from '../utils/format'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Search, Filter, Download, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import TransactionModal from '../components/TransactionModal'
import ImportModal from '../components/ImportModal'
import { useToast } from '../App'

const PAGE_SIZE = 50

const Transactions = () => {
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1,
  })

  const loadTransactions = useCallback(async (pageNum: number) => {
    try {
      setLoading(true)
      const params: Record<string, any> = { page: pageNum, limit: PAGE_SIZE }
      if (filterType !== 'all') params.type = filterType
      const result = await transactionsApi.getAll(params)
      setTransactions(result.data)
      setPagination(result.pagination)
    } catch (error) {
      console.error('Ошибка загрузки транзакций:', error)
    } finally {
      setLoading(false)
    }
  }, [filterType])

  const loadMeta = useCallback(async () => {
    try {
      const [categoriesData, counterpartiesData] = await Promise.all([
        categoriesApi.getAll(),
        counterpartiesApi.getAll(),
      ])
      setCategories(categoriesData)
      setCounterparties(counterpartiesData)
    } catch (error) {
      console.error('Ошибка загрузки справочников:', error)
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  useEffect(() => {
    setPage(1)
    loadTransactions(1)
  }, [filterType, loadTransactions])

  useEffect(() => {
    loadTransactions(page)
  }, [page, loadTransactions])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту транзакцию?')) {
      return
    }

    try {
      await transactionsApi.delete(id)
      loadTransactions(page)
    } catch (error) {
      console.error('Ошибка удаления транзакции:', error)
      showToast('Не удалось удалить транзакцию', 'error')
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
    loadTransactions(page)
  }

  // Client-side search filter (search within currently loaded page)
  const filteredTransactions = searchTerm
    ? transactions.filter(transaction => {
        const term = searchTerm.toLowerCase()
        return (
          transaction.description.toLowerCase().includes(term) ||
          (transaction.counterparty?.name || '').toLowerCase().includes(term) ||
          (transaction.category?.name || '').toLowerCase().includes(term)
        )
      })
    : transactions

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-gray-600 mt-1">Управление доходами и расходами</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => transactionsApi.exportXlsx()}
            className="btn btn-secondary flex items-center space-x-2"
            title="Экспорт в Excel"
          >
            <Download className="h-4 w-4" />
            <span>Экспорт</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary flex items-center space-x-2"
            title="Импорт из Excel"
          >
            <Upload className="h-4 w-4" />
            <span>Импорт</span>
          </button>
          <button onClick={handleAdd} className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Добавить</span>
          </button>
        </div>
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
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-3">Загрузка...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Транзакции не найдены</p>
            <button onClick={handleAdd} className="btn btn-primary mt-4">
              Добавить первую транзакцию
            </button>
          </div>
        ) : (
          <>
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
                    <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
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
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Показано {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} из{' '}
                  {pagination.total}
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-primary-500 text-white'
                            : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
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

      {isImportModalOpen && (
        <ImportModal
          onClose={() => {
            setIsImportModalOpen(false)
            loadTransactions(page)
          }}
        />
      )}
    </div>
  )
}

export default Transactions
