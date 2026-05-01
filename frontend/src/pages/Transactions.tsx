import { useEffect, useState, useCallback } from 'react'
import { transactionsApi, PaginationMeta } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import { counterpartiesApi } from '../api/counterparties'
import { Transaction, Category, Counterparty, TransactionType } from '../api/types'
import { formatCurrency } from '../utils/format'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Search, Filter, Download, Upload, ChevronLeft, ChevronRight, ArrowLeftRight, X } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import TransactionModal from '../components/TransactionModal'
import ImportModal from '../components/ImportModal'
import { useToast } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'

const PAGE_SIZE = 50

const Transactions = () => {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
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

  // Transfer marking state
  const [transferSource, setTransferSource] = useState<Transaction | null>(null)
  const [transferCandidates, setTransferCandidates] = useState<Transaction[]>([])
  const [transferLoading, setTransferLoading] = useState(false)
  const [selectedMirrorId, setSelectedMirrorId] = useState<string | null>(null)
  const [transferSubmitting, setTransferSubmitting] = useState(false)

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
    const ok = await confirm({
      title: 'Удалить транзакцию?',
      message: 'Вы уверены, что хотите удалить эту транзакцию? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await transactionsApi.delete(id)
      loadTransactions(page)
    } catch (error) {
      console.error('Ошибка удаления транзакции:', error)
      toast.error('Не удалось удалить транзакцию')
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

  const openTransferDialog = async (tx: Transaction) => {
    setTransferSource(tx)
    setSelectedMirrorId(null)
    setTransferCandidates([])
    setTransferLoading(true)
    try {
      const list = await transactionsApi.transferCandidates(tx.id)
      setTransferCandidates(list)
    } catch (error) {
      console.error('Ошибка загрузки кандидатов:', error)
      toast.error('Не удалось загрузить кандидатов')
    } finally {
      setTransferLoading(false)
    }
  }

  const closeTransferDialog = () => {
    setTransferSource(null)
    setTransferCandidates([])
    setSelectedMirrorId(null)
  }

  const handleConfirmTransfer = async () => {
    if (!transferSource || !selectedMirrorId) return
    try {
      setTransferSubmitting(true)
      await transactionsApi.markTransfer(transferSource.id, selectedMirrorId)
      toast.success('Помечено как перевод между счетами')
      closeTransferDialog()
      loadTransactions(page)
    } catch (error) {
      console.error('Ошибка связывания перевода:', error)
      toast.error('Не удалось связать транзакции')
    } finally {
      setTransferSubmitting(false)
    }
  }

  const handleUnmarkTransfer = async (tx: Transaction) => {
    const ok = await confirm({
      title: 'Снять метку перевода?',
      message: 'Транзакция (и связанная) перестанет считаться внутренним переводом и снова попадёт в БДДС.',
      confirmText: 'Снять метку',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await transactionsApi.unmarkTransfer(tx.id)
      toast.success('Метка снята')
      loadTransactions(page)
    } catch (error) {
      console.error('Ошибка снятия метки:', error)
      toast.error('Не удалось снять метку')
    }
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
          <h1 className="text-3xl font-bold text-brand-text">Транзакции</h1>
          <p className="text-brand-text-secondary mt-1">Управление доходами и расходами</p>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brand-text-secondary" />
            <input
              type="text"
              placeholder="Поиск по описанию, контрагенту, категории..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-brand-text-secondary" />
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
            <p className="text-brand-text-secondary mt-3">Загрузка...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-brand-text-secondary text-lg">Транзакции не найдены</p>
            <button onClick={handleAdd} className="btn btn-primary mt-4">
              Добавить первую транзакцию
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Тип</th>
                    <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">Дата</th>
                    <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Описание</th>
                    <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Категория</th>
                    <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Контрагент</th>
                    <th className="text-right py-3 px-4 font-medium text-brand-text-secondary">Сумма</th>
                    <th className="text-right py-3 px-4 font-medium text-brand-text-secondary">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-brand-border hover:bg-subtle">
                      <td className="py-3 px-4">
                        {transaction.type === TransactionType.INCOME ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Доход
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Расход
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-brand-text-secondary whitespace-nowrap">
                        {format(new Date(transaction.date), 'd MMM yyyy', { locale: ru })}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-brand-text flex items-center gap-2">
                          {transaction.description}
                          {transaction.is_inter_account_transfer && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700"
                              title="Внутренний перевод между счетами"
                            >
                              <ArrowLeftRight className="h-3 w-3 mr-0.5" />
                              перевод
                            </span>
                          )}
                        </p>
                        {transaction.notes && (
                          <p className="text-sm text-brand-text-secondary">{transaction.notes}</p>
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
                          <span className="text-brand-text-secondary text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-brand-text-secondary">
                        {transaction.counterparty?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-semibold ${
                            transaction.type === TransactionType.INCOME
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {transaction.type === TransactionType.INCOME ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          {transaction.is_inter_account_transfer ? (
                            <button
                              onClick={() => handleUnmarkTransfer(transaction)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Снять метку перевода"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openTransferDialog(transaction)}
                              className="p-2 text-brand-text-secondary hover:bg-subtle rounded-lg transition-colors"
                              title="Это перевод между счетами"
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                          )}
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
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-brand-border">
                <p className="text-sm text-brand-text-secondary">
                  Показано {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} из{' '}
                  {pagination.total}
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                            : 'border border-brand-border hover:bg-subtle text-brand-text-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="p-2 rounded-lg border border-brand-border hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

      {transferSource && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-brand-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-brand-text">Связать как перевод между счетами</h3>
                <p className="text-xs text-brand-text-secondary mt-1">
                  {transferSource.type === TransactionType.INCOME ? 'Доход' : 'Расход'} ·{' '}
                  {format(new Date(transferSource.date), 'd MMM yyyy', { locale: ru })} ·{' '}
                  {formatCurrency(transferSource.amount)} · {transferSource.description}
                </p>
              </div>
              <button onClick={closeTransferDialog} className="p-1 hover:bg-subtle rounded-lg" aria-label="Закрыть">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {transferLoading ? (
                <div className="py-8 text-center">
                  <div className="animate-spin h-6 w-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : transferCandidates.length === 0 ? (
                <p className="text-sm text-brand-text-secondary py-6 text-center">
                  Не найдено зеркальных транзакций (та же сумма, противоположный тип, дата ±2 дня, другой счёт).
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-brand-text-secondary mb-2">
                    Выберите зеркальную транзакцию:
                  </p>
                  {transferCandidates.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMirrorId === c.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-brand-border hover:bg-subtle'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mirror"
                        value={c.id}
                        checked={selectedMirrorId === c.id}
                        onChange={() => setSelectedMirrorId(c.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-medium ${
                            c.type === TransactionType.INCOME ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {c.type === TransactionType.INCOME ? 'Доход' : 'Расход'}
                          </span>
                          <span className="text-xs text-brand-text-secondary">
                            {format(new Date(c.date), 'd MMM yyyy', { locale: ru })}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-brand-text truncate">{c.description}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-xs text-brand-text-secondary truncate">
                            {c.bank_account?.name || 'Без счёта'}
                            {c.counterparty?.name && ` · ${c.counterparty.name}`}
                          </span>
                          <span className="text-sm font-semibold">{formatCurrency(c.amount)}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-brand-border flex justify-end gap-2">
              <button
                onClick={closeTransferDialog}
                className="btn btn-secondary"
                disabled={transferSubmitting}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="btn btn-primary"
                disabled={!selectedMirrorId || transferSubmitting}
              >
                {transferSubmitting ? 'Связываем…' : 'Связать как перевод'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
