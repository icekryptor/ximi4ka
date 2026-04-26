import { useState, useEffect, useCallback } from 'react'
import { Loader2, Filter, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { cashflowApi, CashflowReport, PeriodBucket } from '../api/cashflow'
import { bankAccountsApi, BankAccount } from '../api/bankAccounts'
import { apiClient } from '../api/client'

interface DrilldownTarget {
  category_id: string | null
  category_name: string
  period_start: string
  period_end: string
  type: 'income' | 'expense'
}

interface DrilldownTx {
  id: string
  date: string
  amount: number | string
  type: 'income' | 'expense'
  description?: string
  raw_description?: string | null
  category?: { id: string; name: string } | null
  counterparty?: { id: string; name: string } | null
}

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

  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)
  const [drilldownTx, setDrilldownTx] = useState<DrilldownTx[]>([])
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  useEffect(() => { bankAccountsApi.list().then(setAccounts).catch(console.error) }, [])

  useEffect(() => {
    if (!drilldown) { setDrilldownTx([]); return }
    setDrilldownLoading(true)
    // Reuse existing /api/transactions endpoint (params: startDate, endDate, categoryId, type)
    const params: any = {
      startDate: drilldown.period_start,
      endDate: drilldown.period_end,
      type: drilldown.type,
      limit: 500,
    }
    if (drilldown.category_id) params.categoryId = drilldown.category_id
    apiClient.get('/transactions', { params })
      .then(r => setDrilldownTx(Array.isArray(r.data) ? r.data : (r.data?.items || [])))
      .catch(err => { console.error('[drilldown]', err); setDrilldownTx([]) })
      .finally(() => setDrilldownLoading(false))
  }, [drilldown])

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

  const exportXlsx = () => {
    if (!report) return
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
    const blank = (n: number) => new Array(n).fill('') as (string | number)[]
    const aoa: (string | number)[][] = []
    const periodCount = report.periods.length

    aoa.push(['Категория', ...report.periods.map(p => p.label), 'Итого'])
    aoa.push(['Остаток на начало', ...blank(periodCount), Math.round(report.opening_balance)])

    for (const sec of report.sections) {
      if (sec.inflows.length === 0 && sec.outflows.length === 0) continue
      aoa.push([SECTION_LABELS[sec.code], ...blank(periodCount), ''])

      aoa.push(['  Поступления', ...blank(periodCount), ''])
      sec.inflows.forEach(r => aoa.push([
        '    ' + r.name,
        ...r.values.map(v => Math.round(v)),
        Math.round(sum(r.values)),
      ]))
      aoa.push([
        '  Итого поступлений',
        ...sec.inflows_total.map(v => Math.round(v)),
        Math.round(sum(sec.inflows_total)),
      ])

      aoa.push(['  Выплаты', ...blank(periodCount), ''])
      sec.outflows.forEach(r => aoa.push([
        '    ' + r.name,
        ...r.values.map(v => -Math.round(v)),
        -Math.round(sum(r.values)),
      ]))
      aoa.push([
        '  Итого выплат',
        ...sec.outflows_total.map(v => -Math.round(v)),
        -Math.round(sum(sec.outflows_total)),
      ])

      aoa.push([
        '  Чистый поток',
        ...sec.net.map(v => Math.round(v)),
        Math.round(sum(sec.net)),
      ])
    }

    if (report.unsorted_inflows.length > 0 || report.unsorted_outflows.length > 0) {
      aoa.push(['Без раздела', ...blank(periodCount), ''])
      report.unsorted_inflows.forEach(r => aoa.push([
        '    ' + r.name,
        ...r.values.map(v => Math.round(v)),
        Math.round(sum(r.values)),
      ]))
      report.unsorted_outflows.forEach(r => aoa.push([
        '    ' + r.name,
        ...r.values.map(v => -Math.round(v)),
        -Math.round(sum(r.values)),
      ]))
    }

    aoa.push([
      'ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК',
      ...report.net_cash_flow.map(v => Math.round(v)),
      Math.round(sum(report.net_cash_flow)),
    ])
    aoa.push(['Остаток на конец', ...blank(periodCount), Math.round(report.closing_balance)])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'БДДС')
    XLSX.writeFile(wb, `cashflow_${from}_${to}.xlsx`)
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
        <button
          onClick={exportXlsx}
          disabled={!report}
          className="ml-auto px-3 py-1 text-sm border border-brand-border rounded-lg hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          title="Экспорт в Excel"
        >
          <Download size={14} />
          Excel
        </button>
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
                      periods={report.periods}
                      collapsed={collapsed}
                      onToggle={() => setCollapsedSections(prev => ({ ...prev, [sec.code]: !prev[sec.code] }))}
                      onCellClick={setDrilldown}
                    />
                  )
                })}

                {/* Unsorted */}
                {(report.unsorted_inflows.length > 0 || report.unsorted_outflows.length > 0) && (
                  <UnsortedRows
                    inflows={report.unsorted_inflows}
                    outflows={report.unsorted_outflows}
                    periods={report.periods}
                    periodCount={report.periods.length}
                    onCellClick={setDrilldown}
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

      {/* Drill-down side panel */}
      {drilldown && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-card border-l border-brand-border shadow-2xl z-40 overflow-y-auto">
          <div className="p-4 border-b border-brand-border flex items-center justify-between sticky top-0 bg-card">
            <div>
              <h3 className="font-semibold">{drilldown.category_name}</h3>
              <p className="text-xs text-brand-text-secondary">
                {drilldown.period_start} → {drilldown.period_end}
              </p>
            </div>
            <button
              onClick={() => setDrilldown(null)}
              className="text-brand-text-secondary hover:text-brand-text text-xl leading-none px-2"
              aria-label="Закрыть"
            >×</button>
          </div>
          <div className="p-4">
            {drilldownLoading && <Loader2 size={16} className="animate-spin text-primary-600" />}
            {!drilldownLoading && drilldownTx.length === 0 && (
              <p className="text-sm text-brand-text-secondary">Нет транзакций</p>
            )}
            {drilldownTx.map(tx => (
              <div key={tx.id} className="border-b border-brand-border/40 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span>{tx.date ? new Date(tx.date).toLocaleDateString('ru-RU') : ''}</span>
                  <span className={tx.type === 'income' ? 'text-green-700' : 'text-red-700'}>
                    {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))} ₽
                  </span>
                </div>
                {tx.counterparty?.name && (
                  <p className="text-xs text-brand-text-secondary truncate">{tx.counterparty.name}</p>
                )}
                {tx.description && (
                  <p className="text-xs text-brand-text-secondary truncate">{tx.description}</p>
                )}
                {tx.raw_description && (
                  <p className="text-xs text-brand-text-secondary italic truncate">{tx.raw_description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Section component
function SectionRows({ label, section, periods, collapsed, onToggle, onCellClick }: any) {
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
          <CategoryRowDisplay key={row.category_id} row={row} periods={periods} type="income" onCellClick={onCellClick} />
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
          <CategoryRowDisplay key={row.category_id} row={row} periods={periods} type="expense" onCellClick={onCellClick} />
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

function CategoryRowDisplay({ row, periods, type, onCellClick }: {
  row: any
  periods?: PeriodBucket[]
  type?: 'income' | 'expense'
  onCellClick?: (t: DrilldownTarget) => void
}) {
  const total = row.values.reduce((a: number, b: number) => a + b, 0)
  return (
    <tr className="border-b border-brand-border/30 hover:bg-subtle">
      <td className="px-6 py-1 sticky left-0 bg-card">{row.name}</td>
      {row.values.map((v: number, i: number) => {
        const clickable = !!(v && periods && type && onCellClick)
        return (
          <td
            key={i}
            onClick={clickable ? () => onCellClick!({
              category_id: row.category_id,
              category_name: row.name,
              period_start: periods![i].start,
              period_end: periods![i].end,
              type: type!,
            }) : undefined}
            className={`px-3 py-1 text-right ${clickable ? 'cursor-pointer hover:bg-primary-50' : ''}`}
          >
            {v ? fmt(v) : ''}
          </td>
        )
      })}
      <td className="px-3 py-1 text-right">{fmt(total)}</td>
    </tr>
  )
}

function UnsortedRows({ inflows, outflows, periods, periodCount, onCellClick }: any) {
  if (inflows.length === 0 && outflows.length === 0) return null
  return (
    <>
      <tr className="bg-subtle italic text-brand-text-secondary">
        <td className="px-3 py-2 sticky left-0 bg-subtle" colSpan={periodCount + 2}>
          Без раздела (категории без cashflow_section) — <a href="/categories" className="underline text-primary-600">проставить разделы</a>
        </td>
      </tr>
      {inflows.map((row: any) => (
        <CategoryRowDisplay
          key={(row.category_id || 'null') + ':in'}
          row={row}
          periods={periods}
          type="income"
          onCellClick={onCellClick}
        />
      ))}
      {outflows.map((row: any) => (
        <CategoryRowDisplay
          key={(row.category_id || 'null') + ':out'}
          row={row}
          periods={periods}
          type="expense"
          onCellClick={onCellClick}
        />
      ))}
    </>
  )
}
