import { useEffect, useState } from 'react'
import { financialReportsApi } from '../api/financialReports'
import { CashFlowReport, PnlReport, BalanceReport } from '../api/types'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
} from 'lucide-react'

type Tab = 'cashflow' | 'pnl' | 'balance'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const FinancialReports = () => {
  const [tab, setTab] = useState<Tab>('pnl')
  const [loading, setLoading] = useState(false)

  // Cash flow state
  const [cfYear, setCfYear] = useState(currentYear)
  const [cfPeriod, setCfPeriod] = useState('monthly')
  const [cfValue, setCfValue] = useState(currentMonth)
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null)

  // P&L state
  const [pnlStart, setPnlStart] = useState(`${currentYear}-01-01`)
  const [pnlEnd, setPnlEnd] = useState(new Date().toISOString().split('T')[0])
  const [pnl, setPnl] = useState<PnlReport | null>(null)

  // Balance state
  const [balDate, setBalDate] = useState(new Date().toISOString().split('T')[0])
  const [balance, setBalance] = useState<BalanceReport | null>(null)

  useEffect(() => {
    loadData()
  }, [tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'cashflow') {
        const data = await financialReportsApi.getCashFlow({
          year: cfYear,
          period: cfPeriod,
          value: cfValue,
        })
        setCashFlow(data)
      } else if (tab === 'pnl') {
        const data = await financialReportsApi.getPnl({
          startDate: pnlStart,
          endDate: pnlEnd,
        })
        setPnl(data)
      } else if (tab === 'balance') {
        const data = await financialReportsApi.getBalance({ date: balDate })
        setBalance(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки отчёта:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount)

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ]

  const renderCashFlow = () => {
    if (!cashFlow) return null

    const sections = [
      { key: 'operating' as const, icon: DollarSign, color: 'primary' },
      { key: 'investing' as const, icon: TrendingUp, color: 'amber' },
      { key: 'financing' as const, icon: ArrowUpCircle, color: 'blue' },
    ]

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Год</label>
              <select
                className="input"
                value={cfYear}
                onChange={(e) => setCfYear(Number(e.target.value))}
              >
                {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Период</label>
              <select
                className="input"
                value={cfPeriod}
                onChange={(e) => {
                  setCfPeriod(e.target.value)
                  if (e.target.value === 'monthly') setCfValue(currentMonth)
                  else if (e.target.value === 'quarterly') setCfValue(Math.ceil(currentMonth / 3))
                }}
              >
                <option value="monthly">Месяц</option>
                <option value="quarterly">Квартал</option>
                <option value="yearly">Год</option>
              </select>
            </div>
            {cfPeriod === 'monthly' && (
              <div>
                <label className="label">Месяц</label>
                <select className="input" value={cfValue} onChange={(e) => setCfValue(Number(e.target.value))}>
                  {monthNames.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            {cfPeriod === 'quarterly' && (
              <div>
                <label className="label">Квартал</label>
                <select className="input" value={cfValue} onChange={(e) => setCfValue(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>Q{q}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={loadData} className="btn btn-primary">
              Сформировать
            </button>
          </div>
        </div>

        {/* Opening balance */}
        <div className="card bg-brand-surface">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-brand-text-secondary">Входящий остаток</span>
            <span className="text-xl font-bold text-brand-text">{formatCurrency(cashFlow.openingBalance)}</span>
          </div>
        </div>

        {/* Sections */}
        {sections.map(({ key, icon: Icon }) => {
          const section = cashFlow.sections[key]
          return (
            <div key={key} className="card">
              <div className="flex items-center space-x-2 mb-4">
                <Icon className="h-5 w-5 text-primary-500" />
                <h3 className="text-lg font-bold text-brand-text">{section.label}</h3>
              </div>

              {section.details.income.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-green-600 uppercase mb-1">Поступления</p>
                  {section.details.income.map((item, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm">
                      <span className="text-brand-text-secondary">{item.name}</span>
                      <span className="text-green-600 font-medium">+{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 text-sm font-semibold border-t border-gray-100 mt-1">
                    <span>Итого поступлений</span>
                    <span className="text-green-700">{formatCurrency(section.inflow)}</span>
                  </div>
                </div>
              )}

              {section.details.expense.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-red-600 uppercase mb-1">Выбытия</p>
                  {section.details.expense.map((item, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm">
                      <span className="text-brand-text-secondary">{item.name}</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 text-sm font-semibold border-t border-gray-100 mt-1">
                    <span>Итого выбытий</span>
                    <span className="text-red-700">{formatCurrency(section.outflow)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-brand-border font-bold">
                <span>Чистый поток</span>
                <span className={section.net >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(section.net)}
                </span>
              </div>

              {section.inflow === 0 && section.outflow === 0 && (
                <p className="text-sm text-brand-text-secondary italic">Нет операций за период</p>
              )}
            </div>
          )
        })}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card bg-primary-50">
            <p className="text-sm text-primary-600">Чистый денежный поток</p>
            <p className={`text-2xl font-bold ${cashFlow.totalNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(cashFlow.totalNet)}
            </p>
          </div>
          <div className="card bg-primary-50">
            <p className="text-sm text-primary-600">Исходящий остаток</p>
            <p className="text-2xl font-bold text-brand-text">
              {formatCurrency(cashFlow.closingBalance)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderPnl = () => {
    if (!pnl) return null

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Начало периода</label>
              <input
                type="date"
                className="input"
                value={pnlStart}
                onChange={(e) => setPnlStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Конец периода</label>
              <input
                type="date"
                className="input"
                value={pnlEnd}
                onChange={(e) => setPnlEnd(e.target.value)}
              />
            </div>
            <button onClick={loadData} className="btn btn-primary">
              Сформировать
            </button>
          </div>
        </div>

        {/* P&L Table */}
        <div className="card">
          <div className="space-y-1">
            {/* Revenue */}
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex justify-between items-center font-bold text-green-800">
                <span className="flex items-center space-x-2">
                  <ArrowUpCircle className="h-5 w-5" />
                  <span>Выручка</span>
                </span>
                <span>{formatCurrency(pnl.revenue.total)}</span>
              </div>
              {pnl.revenue.details.map((item, i) => (
                <div key={i} className="flex justify-between text-sm mt-1 pl-7 text-green-700">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* COGS */}
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex justify-between items-center font-bold text-amber-800">
                <span className="flex items-center space-x-2">
                  <MinusCircle className="h-5 w-5" />
                  <span>Себестоимость</span>
                </span>
                <span>-{formatCurrency(pnl.cogs.total)}</span>
              </div>
              {pnl.cogs.details.map((item, i) => (
                <div key={i} className="flex justify-between text-sm mt-1 pl-7 text-amber-700">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Gross Profit */}
            <div className="bg-white rounded-lg p-3 border-2 border-brand-border">
              <div className="flex justify-between items-center font-bold text-brand-text">
                <span>Валовая прибыль</span>
                <span className={pnl.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(pnl.grossProfit)}
                  <span className="text-xs font-normal text-brand-text-secondary ml-2">
                    ({pnl.grossMargin}%)
                  </span>
                </span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex justify-between items-center font-bold text-red-800">
                <span className="flex items-center space-x-2">
                  <ArrowDownCircle className="h-5 w-5" />
                  <span>Операционные расходы</span>
                </span>
                <span>-{formatCurrency(pnl.operatingExpenses.total)}</span>
              </div>
              {pnl.operatingExpenses.details.map((item, i) => (
                <div key={i} className="flex justify-between text-sm mt-1 pl-7 text-red-700">
                  <span>{item.name}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>

            {/* Operating Profit */}
            <div className="bg-white rounded-lg p-3 border-2 border-brand-border">
              <div className="flex justify-between items-center font-bold text-brand-text">
                <span>Операционная прибыль (EBIT)</span>
                <span className={pnl.operatingProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(pnl.operatingProfit)}
                  <span className="text-xs font-normal text-brand-text-secondary ml-2">
                    ({pnl.operatingMargin}%)
                  </span>
                </span>
              </div>
            </div>

            {/* Other */}
            {(pnl.other.income > 0 || pnl.other.expenses > 0) && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center font-bold text-gray-700">
                  <span>Прочие доходы/расходы</span>
                  <span className={pnl.other.net >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {formatCurrency(pnl.other.net)}
                  </span>
                </div>
                {pnl.other.details.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm mt-1 pl-4 text-gray-600">
                    <span>{item.name}</span>
                    <span className={item.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Net Profit */}
            <div className={`rounded-lg p-4 ${pnl.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="flex justify-between items-center font-bold text-lg">
                <span className="text-brand-text">Чистая прибыль</span>
                <span className={pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(pnl.netProfit)}
                  <span className="text-sm font-normal ml-2">
                    ({pnl.netMargin}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Валовая маржа</p>
            <p className="text-2xl font-bold text-primary-600">{pnl.grossMargin}%</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Операционная маржа</p>
            <p className="text-2xl font-bold text-primary-600">{pnl.operatingMargin}%</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-brand-text-secondary">Чистая маржа</p>
            <p className="text-2xl font-bold text-primary-600">{pnl.netMargin}%</p>
          </div>
        </div>
      </div>
    )
  }

  const renderBalance = () => {
    if (!balance) return null

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">На дату</label>
              <input
                type="date"
                className="input"
                value={balDate}
                onChange={(e) => setBalDate(e.target.value)}
              />
            </div>
            <button onClick={loadData} className="btn btn-primary">
              Сформировать
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assets */}
          <div className="card">
            <h3 className="text-lg font-bold text-green-700 mb-4 flex items-center space-x-2">
              <ArrowUpCircle className="h-5 w-5" />
              <span>Активы</span>
            </h3>
            {balance.assets.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2 text-sm border-b border-gray-100">
                <span className="text-brand-text-secondary">{item.name}</span>
                <span className="font-medium">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold text-green-700">
              <span>Итого активы</span>
              <span>{formatCurrency(balance.assets.total)}</span>
            </div>
          </div>

          {/* Liabilities */}
          <div className="card">
            <h3 className="text-lg font-bold text-red-700 mb-4 flex items-center space-x-2">
              <ArrowDownCircle className="h-5 w-5" />
              <span>Обязательства</span>
            </h3>
            {balance.liabilities.items.length === 0 ? (
              <p className="text-sm text-brand-text-secondary italic py-2">Нет обязательств</p>
            ) : (
              balance.liabilities.items.map((item, i) => (
                <div key={i} className="flex justify-between py-2 text-sm border-b border-gray-100">
                  <span className="text-brand-text-secondary">{item.name}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))
            )}
            <div className="flex justify-between pt-3 font-bold text-red-700">
              <span>Итого обязательства</span>
              <span>{formatCurrency(balance.liabilities.total)}</span>
            </div>
          </div>

          {/* Equity */}
          <div className="card">
            <h3 className="text-lg font-bold text-primary-700 mb-4 flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Капитал</span>
            </h3>
            {balance.equity.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2 text-sm border-b border-gray-100">
                <span className="text-brand-text-secondary">{item.name}</span>
                <span className="font-medium">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold text-primary-700">
              <span>Итого капитал</span>
              <span>{formatCurrency(balance.equity.total)}</span>
            </div>
          </div>
        </div>

        {/* Balance check */}
        <div className="card bg-brand-surface text-center">
          <p className="text-sm text-brand-text-secondary mb-1">Проверка баланса</p>
          <p className="text-lg font-bold text-brand-text">
            Активы ({formatCurrency(balance.assets.total)}) = Обязательства ({formatCurrency(balance.liabilities.total)}) + Капитал ({formatCurrency(balance.equity.total)})
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Финансовые отчёты</h1>
        <p className="text-gray-600 mt-1">БДДС, P&L, управленческий баланс</p>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex space-x-2">
          {([
            { key: 'pnl' as Tab, label: 'P&L (Прибыль и убытки)' },
            { key: 'cashflow' as Tab, label: 'БДДС (Денежный поток)' },
            { key: 'balance' as Tab, label: 'Баланс' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === t.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-brand-text-secondary">Формирование отчёта...</p>
        </div>
      ) : (
        <>
          {tab === 'cashflow' && renderCashFlow()}
          {tab === 'pnl' && renderPnl()}
          {tab === 'balance' && renderBalance()}
        </>
      )}
    </div>
  )
}

export default FinancialReports
