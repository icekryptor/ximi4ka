import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction, TransactionType } from '../entities/Transaction';
import { CategoryGroup } from '../entities/Category';

const transactionRepository = AppDataSource.getRepository(Transaction);

// Helper: compute start/end of period
function getPeriodBounds(year: number, period: string, value?: number) {
  let startDate: string;
  let endDate: string;

  if (period === 'yearly') {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else if (period === 'quarterly' && value) {
    const qStart = (value - 1) * 3 + 1;
    const qEnd = qStart + 2;
    startDate = `${year}-${String(qStart).padStart(2, '0')}-01`;
    const lastDay = new Date(year, qEnd, 0).getDate();
    endDate = `${year}-${String(qEnd).padStart(2, '0')}-${lastDay}`;
  } else if (period === 'monthly' && value) {
    startDate = `${year}-${String(value).padStart(2, '0')}-01`;
    const lastDay = new Date(year, value, 0).getDate();
    endDate = `${year}-${String(value).padStart(2, '0')}-${lastDay}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  return { startDate, endDate };
}

// SQL: get opening balance (sum before startDate)
async function getOpeningBalance(startDate: string): Promise<number> {
  const prevDay = new Date(new Date(startDate).getTime() - 86400000)
    .toISOString()
    .split('T')[0];

  const result = await transactionRepository
    .createQueryBuilder('t')
    .select(
      `SUM(CASE WHEN t.type = :income THEN t.amount ELSE -t.amount END)`,
      'balance'
    )
    .where('t.date <= :prevDay', { prevDay })
    .setParameter('income', TransactionType.INCOME)
    .getRawOne();

  return Number(result?.balance) || 0;
}

// SQL: aggregate transactions by category group + category name + type
interface GroupedRow {
  group_key: string;
  category_name: string;
  type: string;
  total: string;
}

async function getGroupedTransactions(
  startDate: string,
  endDate: string
): Promise<GroupedRow[]> {
  return transactionRepository
    .createQueryBuilder('t')
    .leftJoin('t.category', 'c')
    .select("COALESCE(c.group, 'other')", 'group_key')
    .addSelect("COALESCE(c.name, 'Без категории')", 'category_name')
    .addSelect('t.type', 'type')
    .addSelect('SUM(t.amount)', 'total')
    .where('t.date BETWEEN :startDate AND :endDate', { startDate, endDate })
    .groupBy("COALESCE(c.group, 'other')")
    .addGroupBy("COALESCE(c.name, 'Без категории')")
    .addGroupBy('t.type')
    .getRawMany();
}

// Transform grouped rows into structured data
interface GroupData {
  income: number;
  expense: number;
  items: { name: string; amount: number; type: string }[];
}

function buildGroupsFromRows(rows: GroupedRow[]): Record<string, GroupData> {
  const groups: Record<string, GroupData> = {
    operating_income: { income: 0, expense: 0, items: [] },
    cogs: { income: 0, expense: 0, items: [] },
    operating_expense: { income: 0, expense: 0, items: [] },
    investing: { income: 0, expense: 0, items: [] },
    financing: { income: 0, expense: 0, items: [] },
    other: { income: 0, expense: 0, items: [] },
  };

  for (const row of rows) {
    const group = row.group_key || 'other';
    if (!groups[group]) {
      groups[group] = { income: 0, expense: 0, items: [] };
    }

    const amount = Number(row.total) || 0;

    if (row.type === TransactionType.INCOME) {
      groups[group].income += amount;
    } else {
      groups[group].expense += amount;
    }

    groups[group].items.push({
      name: row.category_name,
      amount,
      type: row.type,
    });
  }

  return groups;
}

export const financialReportController = {
  // ===== БДДС (Cash Flow Statement) =====
  async getCashFlow(req: Request, res: Response) {
    try {
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();
      const period = (req.query.period as string) || 'monthly';
      const value = req.query.value
        ? parseInt(req.query.value as string)
        : undefined;

      const { startDate, endDate } = getPeriodBounds(year, period, value);

      // SQL aggregation instead of loading all rows
      const [openingBalance, groupedRows] = await Promise.all([
        getOpeningBalance(startDate),
        getGroupedTransactions(startDate, endDate),
      ]);

      const groups = buildGroupsFromRows(groupedRows);

      // Operating activity
      const operatingInflow =
        groups.operating_income.income + groups.other.income;
      const operatingOutflow =
        groups.cogs.expense +
        groups.operating_expense.expense +
        groups.other.expense;
      const operatingNet = operatingInflow - operatingOutflow;

      // Investing activity
      const investingInflow = groups.investing.income;
      const investingOutflow = groups.investing.expense;
      const investingNet = investingInflow - investingOutflow;

      // Financing activity
      const financingInflow = groups.financing.income;
      const financingOutflow = groups.financing.expense;
      const financingNet = financingInflow - financingOutflow;

      const totalNet = operatingNet + investingNet + financingNet;
      const closingBalance = openingBalance + totalNet;

      res.json({
        period: { year, period, value, startDate, endDate },
        openingBalance,
        sections: {
          operating: {
            label: 'Операционная деятельность',
            inflow: operatingInflow,
            outflow: operatingOutflow,
            net: operatingNet,
            details: {
              income: [
                ...groups.operating_income.items.filter(
                  (i) => i.type === 'income'
                ),
                ...groups.other.items.filter((i) => i.type === 'income'),
              ],
              expense: [
                ...groups.cogs.items.filter((i) => i.type === 'expense'),
                ...groups.operating_expense.items.filter(
                  (i) => i.type === 'expense'
                ),
                ...groups.other.items.filter((i) => i.type === 'expense'),
              ],
            },
          },
          investing: {
            label: 'Инвестиционная деятельность',
            inflow: investingInflow,
            outflow: investingOutflow,
            net: investingNet,
            details: {
              income: groups.investing.items.filter(
                (i) => i.type === 'income'
              ),
              expense: groups.investing.items.filter(
                (i) => i.type === 'expense'
              ),
            },
          },
          financing: {
            label: 'Финансовая деятельность',
            inflow: financingInflow,
            outflow: financingOutflow,
            net: financingNet,
            details: {
              income: groups.financing.items.filter(
                (i) => i.type === 'income'
              ),
              expense: groups.financing.items.filter(
                (i) => i.type === 'expense'
              ),
            },
          },
        },
        totalNet,
        closingBalance,
      });
    } catch (error) {
      console.error('Ошибка БДДС:', error);
      res.status(500).json({ error: 'Ошибка при формировании БДДС' });
    }
  },

  // ===== P&L (Profit & Loss) =====
  async getPnl(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ error: 'Необходимо указать startDate и endDate' });
      }

      // Single SQL query with GROUP BY instead of loading all transactions
      const groupedRows = await getGroupedTransactions(startDate, endDate);
      const groups = buildGroupsFromRows(groupedRows);

      // Revenue (operating income)
      const revenue = groups.operating_income.income;
      const revenueDetails = groups.operating_income.items.filter(
        (i) => i.type === 'income'
      );

      // COGS
      const cogs = groups.cogs.expense;
      const cogsDetails = groups.cogs.items.filter(
        (i) => i.type === 'expense'
      );

      // Gross profit
      const grossProfit = revenue - cogs;

      // Operating expenses
      const operatingExpenses = groups.operating_expense.expense;
      const opexDetails = groups.operating_expense.items.filter(
        (i) => i.type === 'expense'
      );

      // Operating profit (EBIT)
      const operatingProfit = grossProfit - operatingExpenses;

      // Other income / expenses
      const otherIncome =
        groups.other.income +
        groups.investing.income +
        groups.financing.income;
      const otherExpenses =
        groups.other.expense +
        groups.investing.expense +
        groups.financing.expense;
      const otherNet = otherIncome - otherExpenses;

      const otherDetails = [
        ...groups.other.items,
        ...groups.investing.items,
        ...groups.financing.items,
      ];

      // Net profit
      const netProfit = operatingProfit + otherNet;

      // Margins
      const grossMargin =
        revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const operatingMargin =
        revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
      const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      res.json({
        period: { startDate, endDate },
        revenue: { total: revenue, details: revenueDetails },
        cogs: { total: cogs, details: cogsDetails },
        grossProfit,
        grossMargin: Math.round(grossMargin * 10) / 10,
        operatingExpenses: { total: operatingExpenses, details: opexDetails },
        operatingProfit,
        operatingMargin: Math.round(operatingMargin * 10) / 10,
        other: {
          income: otherIncome,
          expenses: otherExpenses,
          net: otherNet,
          details: otherDetails,
        },
        netProfit,
        netMargin: Math.round(netMargin * 10) / 10,
      });
    } catch (error) {
      console.error('Ошибка P&L:', error);
      res.status(500).json({ error: 'Ошибка при формировании P&L' });
    }
  },

  // ===== Balance Sheet =====
  async getBalance(req: Request, res: Response) {
    try {
      const asOfDate =
        (req.query.date as string) ||
        new Date().toISOString().split('T')[0];

      // Single SQL query instead of loading all transactions
      const result = await transactionRepository
        .createQueryBuilder('t')
        .select(
          `SUM(CASE WHEN t.type = :income THEN t.amount ELSE -t.amount END)`,
          'cash'
        )
        .where('t.date <= :asOfDate', { asOfDate })
        .setParameter('income', TransactionType.INCOME)
        .getRawOne();

      const cash = Number(result?.cash) || 0;

      res.json({
        date: asOfDate,
        assets: {
          total: cash,
          items: [{ name: 'Денежные средства', amount: cash }],
        },
        liabilities: {
          total: 0,
          items: [],
        },
        equity: {
          total: cash,
          items: [{ name: 'Нераспределённая прибыль', amount: cash }],
        },
      });
    } catch (error) {
      console.error('Ошибка баланса:', error);
      res.status(500).json({ error: 'Ошибка при формировании баланса' });
    }
  },
};
