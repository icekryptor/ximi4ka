import { useEffect, useState } from 'react'
import { reportsApi } from '../api/reports'
import { transactionsApi } from '../api/transactions'
import { FinancialSummary, Transaction } from '../api/types'
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

const Dashboard = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const [summaryData, transactionsData] = await Promise.all([
        reportsApi.getSummary({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }),
        transactionsApi.getAll()
      ])

      setSummary(summaryData)
      setRecentTransactions(transactionsData.slice(0, 5))
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Главная панель</h1>
        <p className="text-gray-600 mt-1">Обзор финансов за последние 30 дней</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Доходы</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {formatCurrency(summary?.income || 0)}
              </p>
            </div>
            <div className="bg-green-200 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-700" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Расходы</p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                {formatCurrency(summary?.expense || 0)}
              </p>
            </div>
            <div className="bg-red-200 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-700" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Баланс</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {formatCurrency(summary?.balance || 0)}
              </p>
            </div>
            <div className="bg-blue-200 p-3 rounded-full">
              <Wallet className="h-6 w-6 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Транзакций</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {summary?.transactionCount || 0}
              </p>
            </div>
            <div className="bg-purple-200 p-3 rounded-full">
              <Activity className="h-6 w-6 text-purple-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Последние транзакции</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Нет транзакций</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-2 rounded-full ${
                      transaction.type === 'income'
                        ? 'bg-green-100'
                        : 'bg-red-100'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(transaction.date), 'd MMMM yyyy', { locale: ru })}
                      {transaction.category && ` • ${transaction.category.name}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      transaction.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
