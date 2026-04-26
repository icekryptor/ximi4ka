import { useState, useEffect, useCallback } from 'react'
import { Loader2, Filter } from 'lucide-react'
import { cashflowApi, CashflowReport } from '../api/cashflow'
import { bankAccountsApi, BankAccount } from '../api/bankAccounts'

const SECTION_LABELS: Record<string, string> = {
  operational: 'Операционная деятельность',
  investing:   'Инвестиционная деятельность',
  financing:   'Финансовая деятельность',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

export default function Cashflow() {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const yearEnd   = `${today.getFullYear()}-12-31`

  const [from, setFrom] = useState(yearStart)
  const [to, setTo]     = useState(yearEnd)
  const [granularity, setGranularity] = useState<'month' | 'week'>('month')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])  // empty = all

  const [report, setReport] = useState<CashflowReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  useEffect(() => { bankAccountsApi.list().then(setAccounts).catch(console.error) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await cashflowApi.report({
        from, to, granularity,
        accounts: selectedAccounts.length ? selectedAccounts : undefined,
      })
      setReport(r)
    } finally { setLoading(false) }
  }, [from, to, granularity, selectedAccounts])

  useEffect(() => { load() }, [load])

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl sm:text-2xl font-bold text-brand-text mb-4">БДДС / Отчёт о движении денежных средств</h1>

      {/* Filters bar */}
      <div className="bg-card border border-brand-border rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-brand-text-secondary" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-brand-border rounded-lg px-2 py-1 bg-card" />
          <span className="text-brand-text-secondary">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-brand-border rounded-lg px-2 py-1 bg-card" />
        </div>
        <div className="flex bg-subtle rounded-lg p-0.5">
          {(['month', 'week'] as const).map(g => (
            <button key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-sm rounded-md ${granularity === g ? 'bg-card shadow-sm' : 'text-brand-text-secondary'}`}
            >
              {g === 'month' ? 'Месяц' : 'Неделя'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {accounts.map(a => (
            <button key={a.id}
              onClick={() => toggleAccount(a.id)}
              className={`px-3 py-1 text-xs rounded-lg border ${
                selectedAccounts.length === 0 || selectedAccounts.includes(a.id)
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-card border-brand-border text-brand-text-secondary'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-primary-600" />}
      </div>

      {/* Report table */}
      {report && (
        <div className="bg-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-subtle z-10 min-w-[280px]">Категория</th>
                  {report.periods.map(p => (
                    <th key={p.start} className="text-right px-3 py-2 whitespace-nowrap">{p.label}</th>
                  ))}
                  <th className="text-right px-3 py-2 bg-card font-semibold">Итого</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance */}
                <tr className="border-b border-brand-border bg-amber-50/50 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50/50">Остаток на начало</td>
                  <td colSpan={report.periods.length} className="text-center text-brand-text-secondary">—</td>
                  <td className="px-3 py-2 text-right">{fmt(report.opening_balance)} ₽</td>
                </tr>

                {/* Sections */}
                {report.sections.map(sec => {
                  const isEmpty = sec.inflows.length === 0 && sec.outflows.length === 0
                  if (isEmpty) return null
                  const collapsed = collapsedSections[sec.code]
                  return (
                    <SectionRows
                      key={sec.code}
                      label={SECTION_LABELS[sec.code]}
                      section={sec}
                      collapsed={collapsed}
                      onToggle={() => setCollapsedSections(prev => ({ ...prev, [sec.code]: !prev[sec.code] }))}
                    />
                  )
                })}

                {/* Unsorted */}
                {(report.unsorted_inflows.length > 0 || report.unsorted_outflows.length > 0) && (
                  <UnsortedRows
                    inflows={report.unsorted_inflows}
                    outflows={report.unsorted_outflows}
                    periodCount={report.periods.length}
                  />
                )}

                {/* Totals */}
                <tr className="border-t-2 border-brand-border bg-primary-50 font-bold">
                  <td className="px-3 py-2 sticky left-0 bg-primary-50">ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК</td>
                  {report.net_cash_flow.map((v, i) => (
                    <td key={i} className={`px-3 py-2 text-right ${v >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {v >= 0 ? '+' : ''}{fmt(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {fmt(report.net_cash_flow.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
                <tr className="border-b border-brand-border bg-amber-50/50 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50/50">Остаток на конец</td>
                  <td colSpan={report.periods.length} className="text-center text-brand-text-secondary">—</td>
                  <td className="px-3 py-2 text-right">{fmt(report.closing_balance)} ₽</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Section component
function SectionRows({ label, section, collapsed, onToggle }: any) {
  const inflowsTotalSum = section.inflows_total.reduce((a: number, b: number) => a + b, 0)
  const outflowsTotalSum = section.outflows_total.reduce((a: number, b: number) => a + b, 0)
  const netTotalSum = section.net.reduce((a: number, b: number) => a + b, 0)
  return (
    <>
      <tr className="bg-subtle font-semibold cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 sticky left-0 bg-subtle">{collapsed ? '▶' : '▼'} {label}</td>
        <td colSpan={section.net.length + 1} className="text-right text-brand-text-secondary text-xs px-3">
          {collapsed && `Чистый: ${fmt(netTotalSum)}`}
        </td>
      </tr>
      {!collapsed && <>
        <tr><td className="px-6 py-1 text-xs text-brand-text-secondary italic" colSpan={section.net.length + 2}>Поступления</td></tr>
        {section.inflows.map((row: any) => (
          <CategoryRowDisplay key={row.category_id} row={row} />
        ))}
        <tr className="border-b border-brand-border/50 italic">
          <td className="px-6 py-1 sticky left-0 bg-card text-brand-text-secondary">Итого поступлений</td>
          {section.inflows_total.map((v: number, i: number) => (
            <td key={i} className="px-3 py-1 text-right">{fmt(v)}</td>
          ))}
          <td className="px-3 py-1 text-right font-semibold">{fmt(inflowsTotalSum)}</td>
        </tr>

        <tr><td className="px-6 py-1 text-xs text-brand-text-secondary italic" colSpan={section.net.length + 2}>Выплаты</td></tr>
        {section.outflows.map((row: any) => (
          <CategoryRowDisplay key={row.category_id} row={row} />
        ))}
        <tr className="border-b border-brand-border/50 italic">
          <td className="px-6 py-1 sticky left-0 bg-card text-brand-text-secondary">Итого выплат</td>
          {section.outflows_total.map((v: number, i: number) => (
            <td key={i} className="px-3 py-1 text-right text-red-700">−{fmt(v)}</td>
          ))}
          <td className="px-3 py-1 text-right font-semibold text-red-700">−{fmt(outflowsTotalSum)}</td>
        </tr>

        <tr className="border-b border-brand-border bg-blue-50/50 font-semibold">
          <td className="px-6 py-2 sticky left-0 bg-blue-50/50">Чистый поток</td>
          {section.net.map((v: number, i: number) => (
            <td key={i} className={`px-3 py-2 text-right ${v >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {v >= 0 ? '+' : ''}{fmt(v)}
            </td>
          ))}
          <td className="px-3 py-2 text-right">{fmt(netTotalSum)}</td>
        </tr>
      </>}
    </>
  )
}

function CategoryRowDisplay({ row }: { row: any }) {
  const total = row.values.reduce((a: number, b: number) => a + b, 0)
  return (
    <tr className="border-b border-brand-border/30 hover:bg-subtle">
      <td className="px-6 py-1 sticky left-0 bg-card">{row.name}</td>
      {row.values.map((v: number, i: number) => (
        <td key={i} className="px-3 py-1 text-right">{v ? fmt(v) : ''}</td>
      ))}
      <td className="px-3 py-1 text-right">{fmt(total)}</td>
    </tr>
  )
}

function UnsortedRows({ inflows, outflows, periodCount }: any) {
  if (inflows.length === 0 && outflows.length === 0) return null
  return (
    <>
      <tr className="bg-subtle italic text-brand-text-secondary">
        <td className="px-3 py-2 sticky left-0 bg-subtle" colSpan={periodCount + 2}>
          Без раздела (категории без cashflow_section) — <a href="/categories" className="underline text-primary-600">проставить разделы</a>
        </td>
      </tr>
      {[...inflows, ...outflows].map((row: any) => (
        <CategoryRowDisplay key={(row.category_id || 'null') + ':' + (inflows.includes(row) ? 'in' : 'out')} row={row} />
      ))}
    </>
  )
}
