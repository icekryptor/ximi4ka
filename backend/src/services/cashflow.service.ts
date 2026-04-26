import { AppDataSource } from '../config/database'

export type Granularity = 'month' | 'week'
export type SectionCode = 'operational' | 'investing' | 'financing' | null

export interface PeriodBucket {
  start: string  // ISO
  end: string
  label: string
}

export interface CategoryRow {
  category_id: string | null
  name: string
  parent_id: string | null
  cashflow_section: SectionCode
  values: number[]      // one per period
}

export interface CashflowReport {
  periods: PeriodBucket[]
  sections: Array<{
    code: 'operational' | 'investing' | 'financing'
    inflows: CategoryRow[]
    outflows: CategoryRow[]
    inflows_total: number[]
    outflows_total: number[]
    net: number[]
  }>
  unsorted_inflows: CategoryRow[]    // categories without cashflow_section
  unsorted_outflows: CategoryRow[]
  opening_balance: number
  closing_balance: number
  net_cash_flow: number[]
}

interface Filters {
  from: string                   // ISO start
  to: string                     // ISO end inclusive
  granularity: Granularity
  account_ids?: string[]
  counterparty_id?: string
}

function buildPeriods(from: string, to: string, granularity: Granularity): PeriodBucket[] {
  const periods: PeriodBucket[] = []
  const start = new Date(from)
  const end = new Date(to)

  if (granularity === 'month') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)  // last day of month
      periods.push({
        start: cur.toISOString().slice(0, 10),
        end:   next.toISOString().slice(0, 10),
        label: cur.toLocaleString('ru-RU', { month: 'short', year: '2-digit' }),
      })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    // week: Monday-Sunday
    const dayOfWeek = (start.getDay() + 6) % 7   // Mon=0..Sun=6
    let cur = new Date(start)
    cur.setDate(cur.getDate() - dayOfWeek)
    while (cur <= end) {
      const next = new Date(cur)
      next.setDate(next.getDate() + 6)
      periods.push({
        start: cur.toISOString().slice(0, 10),
        end:   next.toISOString().slice(0, 10),
        label: `${cur.getDate()}.${(cur.getMonth()+1).toString().padStart(2,'0')}`,
      })
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 7)
    }
  }
  return periods
}

export async function buildCashflowReport(f: Filters): Promise<CashflowReport> {
  const periods = buildPeriods(f.from, f.to, f.granularity)
  const trunc = f.granularity === 'month' ? 'month' : 'week'

  // Single aggregation query
  const qb = AppDataSource.createQueryBuilder()
    .select(`date_trunc('${trunc}', t.date)`, 'period')
    .addSelect('t.category_id', 'category_id')
    .addSelect('t.type', 'type')
    .addSelect('SUM(t.amount)', 'amount')
    .from('transactions', 't')
    .where('t.date >= :from', { from: f.from })
    .andWhere('t.date <= :to', { to: f.to })
    .andWhere('t.is_inter_account_transfer = false')

  if (f.account_ids && f.account_ids.length > 0) {
    qb.andWhere('t.bank_account_id IN (:...accs)', { accs: f.account_ids })
  }
  if (f.counterparty_id) qb.andWhere('t.counterparty_id = :cp', { cp: f.counterparty_id })

  qb.groupBy('period').addGroupBy('t.category_id').addGroupBy('t.type')

  const rows = await qb.getRawMany<{ period: Date; category_id: string | null; type: 'income' | 'expense'; amount: string }>()

  // Index categories
  const cats = await AppDataSource.query(`
    SELECT id, name, parent_id, cashflow_section, type FROM categories
  `) as Array<{ id: string; name: string; parent_id: string | null; cashflow_section: SectionCode; type: 'income'|'expense' }>
  const catById = new Map(cats.map(c => [c.id, c]))

  // Bucket index for quick period lookup by date
  const periodIndex = new Map<string, number>()
  periods.forEach((p, i) => periodIndex.set(p.start, i))

  function periodIndexFor(d: Date): number {
    if (f.granularity === 'month') {
      const key = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
      return periodIndex.get(key) ?? -1
    } else {
      const dow = (d.getDay() + 6) % 7
      const ws = new Date(d)
      ws.setDate(ws.getDate() - dow)
      const key = ws.toISOString().slice(0, 10)
      return periodIndex.get(key) ?? -1
    }
  }

  // Build per-category time series
  const seriesByKey = new Map<string, CategoryRow>()  // key = `${categoryId}:${type}`
  for (const row of rows) {
    const idx = periodIndexFor(new Date(row.period))
    if (idx < 0) continue
    const cat = row.category_id ? catById.get(row.category_id) : null
    const key = `${row.category_id || 'null'}:${row.type}`
    let series = seriesByKey.get(key)
    if (!series) {
      series = {
        category_id: row.category_id,
        name: cat?.name || '— Без категории',
        parent_id: cat?.parent_id || null,
        cashflow_section: cat?.cashflow_section || null,
        values: new Array(periods.length).fill(0),
      }
      seriesByKey.set(key, series)
    }
    series.values[idx] = (series.values[idx] || 0) + parseFloat(row.amount)
  }

  // Group by section
  const sections: CashflowReport['sections'] = (['operational', 'investing', 'financing'] as const).map(code => {
    const inflows: CategoryRow[] = []
    const outflows: CategoryRow[] = []
    for (const [key, series] of seriesByKey) {
      if (series.cashflow_section !== code) continue
      const isIncome = key.endsWith(':income')
      if (isIncome) inflows.push(series)
      else outflows.push(series)
    }
    inflows.sort((a, b) => a.name.localeCompare(b.name))
    outflows.sort((a, b) => a.name.localeCompare(b.name))

    const inflows_total = periods.map((_, i) => inflows.reduce((s, r) => s + (r.values[i] || 0), 0))
    const outflows_total = periods.map((_, i) => outflows.reduce((s, r) => s + (r.values[i] || 0), 0))
    const net = periods.map((_, i) => inflows_total[i] - outflows_total[i])
    return { code, inflows, outflows, inflows_total, outflows_total, net }
  })

  // Unsorted (no cashflow_section)
  const unsorted_inflows: CategoryRow[] = []
  const unsorted_outflows: CategoryRow[] = []
  for (const [key, series] of seriesByKey) {
    if (series.cashflow_section !== null) continue
    if (key.endsWith(':income')) unsorted_inflows.push(series)
    else unsorted_outflows.push(series)
  }

  // Net cash flow per period
  const net_cash_flow = periods.map((_, i) =>
    sections.reduce((s, sec) => s + sec.net[i], 0) +
    unsorted_inflows.reduce((s, r) => s + (r.values[i] || 0), 0) -
    unsorted_outflows.reduce((s, r) => s + (r.values[i] || 0), 0)
  )

  // Opening balance: sum of opening_balance across selected accounts +
  // all transactions before f.from (excluding transfers)
  const accountFilter = (f.account_ids && f.account_ids.length > 0)
    ? `AND id = ANY($1::uuid[])` : ``
  const accParams = (f.account_ids && f.account_ids.length > 0) ? [f.account_ids] : []
  const openingRow = await AppDataSource.query(
    `SELECT COALESCE(SUM(opening_balance), 0) as ob FROM bank_accounts WHERE is_active = true ${accountFilter}`,
    accParams,
  ) as Array<{ ob: string }>
  const ob_static = parseFloat(openingRow[0]?.ob || '0')

  const beforeQb = AppDataSource.createQueryBuilder()
    .select('t.type', 'type').addSelect('SUM(t.amount)', 'amount')
    .from('transactions', 't')
    .where('t.date < :from', { from: f.from })
    .andWhere('t.is_inter_account_transfer = false')
  if (f.account_ids && f.account_ids.length > 0) {
    beforeQb.andWhere('t.bank_account_id IN (:...accs)', { accs: f.account_ids })
  }
  beforeQb.groupBy('t.type')
  const before = await beforeQb.getRawMany<{ type: 'income'|'expense'; amount: string }>()
  const ob_dynamic = before.reduce((s, r) => r.type === 'income' ? s + parseFloat(r.amount) : s - parseFloat(r.amount), 0)

  const opening_balance = ob_static + ob_dynamic
  const closing_balance = opening_balance + net_cash_flow.reduce((a, b) => a + b, 0)

  return {
    periods,
    sections,
    unsorted_inflows,
    unsorted_outflows,
    opening_balance,
    closing_balance,
    net_cash_flow,
  }
}
