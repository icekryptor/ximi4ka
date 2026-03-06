import { useEffect, useState } from 'react'
import { reportsApi } from '../api/reports'
import { FinancialSummary, CategoryReport, CounterpartyReport, TransactionType } from '../api/types'
import { formatCurrency } from '../utils/format'
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Reports = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [categoryReport, setCategoryReport] = useState<CategoryReport[]>([])
  const [counterpartyReport, setCounterpartyReport] = useState<CounterpartyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [reportType, setReportType] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [dateRange, reportType])

  const loadData = async () => {
    try {
      setLoading(true)
      const typeFilter = reportType === 'all' ? undefined : reportType

      const [summaryData, categoryData, counterpartyData] = await Promise.all([
        reportsApi.getSummary(dateRange),
        reportsApi.getByCategory({ ...dateRange, type: typeFilter }),
        reportsApi.getByCounterparty({ ...dateRange, type: typeFilter })
      ])

      setSummary(summaryData)
      setCategoryReport(categoryData.slice(0, 10))
      setCounterpartyReport(counterpartyData.slice(0, 10))
    } catch (error) {
      console.error('Ошибка загрузки отчетов:', error)
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#836efe', '#10b981', '#f59e0b', '#ef4444', '#6703ff', '#ec4899', '#14b8a6', '#f97316']

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Отчёты и аналитика</h1>
        <p className="text-gray-600 mt-1">Финансовый анализ за выбранный период</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div className="flex items-center space-x-2">
              <input
                type="date"
                className="input"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
              <span className="text-gray-500">—</span>
              <input
                type="date"
                className="input"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setReportType('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                reportType === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setReportType(TransactionType.INCOME)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                reportType === TransactionType.INCOME
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Доходы
            </button>
            <button
              onClick={() => setReportType(TransactionType.EXPENSE)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                reportType === TransactionType.EXPENSE
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Расходы
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        <div className={`card bg-gradient-to-br ${
          (summary?.balance || 0) >= 0
            ? 'from-primary-50 to-primary-100 border-primary-200'
            : 'from-orange-50 to-orange-100 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                (summary?.balance || 0) >= 0 ? 'text-primary-600' : 'text-orange-600'
              }`}>
                Баланс
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                (summary?.balance || 0) >= 0 ? 'text-primary-900' : 'text-orange-900'
              }`}>
                {formatCurrency(summary?.balance || 0)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${
              (summary?.balance || 0) >= 0 ? 'bg-primary-200' : 'bg-orange-200'
            }`}>
              <Wallet className={`h-6 w-6 ${
                (summary?.balance || 0) >= 0 ? 'text-primary-700' : 'text-orange-700'
              }`} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Bar Chart */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">По категориям</h2>
          {categoryReport.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryReport}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="total" fill="#836efe" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-12">Нет данных</p>
          )}
        </div>

        {/* Counterparty Pie Chart */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">По контрагентам</h2>
          {counterpartyReport.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={counterpartyReport}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.total)}`}
                >
                  {counterpartyReport.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-12">Нет данных</p>
          )}
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Table */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Топ категорий</h2>
          {categoryReport.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-700">Категория</th>
                    <th className="text-right py-2 font-medium text-gray-700">Сумма</th>
                    <th className="text-right py-2 font-medium text-gray-700">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryReport.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{item.name}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-2 text-right text-gray-600">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Нет данных</p>
          )}
        </div>

        {/* Counterparty Table */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Топ контрагентов</h2>
          {counterpartyReport.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-700">Контрагент</th>
                    <th className="text-right py-2 font-medium text-gray-700">Сумма</th>
                    <th className="text-right py-2 font-medium text-gray-700">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {counterpartyReport.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{item.name}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-2 text-right text-gray-600">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Нет данных</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports
