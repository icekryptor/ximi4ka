import { useEffect, useState } from 'react'
import { reportsApi } from '../api/reports'
import { transactionsApi } from '../api/transactions'
import { FinancialSummary, Transaction } from '../api/types'
import { formatCurrency } from '../utils/format'
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

// Animated count-up hook
const useCountUp = (target: number, duration = 800) => {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    let rafId: number
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(target * eased))
      if (progress < 1) rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return value
}

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

      const [summaryData, transactionsResult] = await Promise.all([
        reportsApi.getSummary({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }),
        transactionsApi.getAll({ page: 1, limit: 5 })
      ])

      setSummary(summaryData)
      setRecentTransactions(transactionsResult.data)
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const animatedIncome = useCountUp(summary?.income || 0)
  const animatedExpense = useCountUp(summary?.expense || 0)
  const animatedBalance = useCountUp(summary?.balance || 0)
  const animatedCount = useCountUp(summary?.transactionCount || 0)

  if (loading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-32 rounded-2xl"></div>
            ))}
          </div>
          <div className="skeleton h-64 rounded-2xl mt-6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">Главная панель</h1>
        <p className="text-brand-text-secondary mt-1">Обзор финансов за последние 30 дней</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div
          className="card-hover bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 stagger-item"
          style={{ animationDelay: '0ms' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Доходы</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                {formatCurrency(animatedIncome)}
              </p>
            </div>
            <div className="bg-green-200 dark:bg-green-800 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-700 dark:text-green-300" />
            </div>
          </div>
        </div>

        <div
          className="card-hover bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 stagger-item"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Расходы</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                {formatCurrency(animatedExpense)}
              </p>
            </div>
            <div className="bg-red-200 dark:bg-red-800 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-700 dark:text-red-300" />
            </div>
          </div>
        </div>

        <div
          className="card-hover bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 border-primary-200 dark:border-primary-800 stagger-item"
          style={{ animationDelay: '160ms' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-600 dark:text-primary-400">Баланс</p>
              <p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-1">
                {formatCurrency(animatedBalance)}
              </p>
            </div>
            <div className="bg-primary-200 dark:bg-primary-800 p-3 rounded-full">
              <Wallet className="h-6 w-6 text-primary-700 dark:text-primary-300" />
            </div>
          </div>
        </div>

        <div
          className="card-hover bg-gradient-to-br from-primary-50/50 to-primary-100/50 dark:from-primary-950/50 dark:to-primary-900/50 border-primary-200 dark:border-primary-800 stagger-item"
          style={{ animationDelay: '240ms' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-500 dark:text-primary-400">Транзакций</p>
              <p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-1">
                {animatedCount}
              </p>
            </div>
            <div className="bg-primary-100 dark:bg-primary-800 p-3 rounded-full">
              <Activity className="h-6 w-6 text-primary-500 dark:text-primary-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card stagger-item" style={{ animationDelay: '320ms' }}>
        <h2 className="text-xl font-bold text-brand-text mb-4">Последние транзакции</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-brand-text-secondary text-center py-8">Нет транзакций</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction, index) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-subtle rounded-lg hover:bg-muted transition-all duration-200 hover:shadow-soft stagger-item"
                style={{ animationDelay: `${380 + index * 60}ms` }}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-2 rounded-full ${
                      transaction.type === 'income'
                        ? 'bg-green-100 dark:bg-green-900'
                        : 'bg-red-100 dark:bg-red-900'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-brand-text">{transaction.description}</p>
                    <p className="text-sm text-brand-text-secondary">
                      {format(new Date(transaction.date), 'd MMMM yyyy', { locale: ru })}
                      {transaction.category && ` • ${transaction.category.name}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      transaction.type === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
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
