import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction, TransactionType } from '../entities/Transaction';
import { Category, CategoryGroup } from '../entities/Category';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

const transactionRepository = AppDataSource.getRepository(Transaction);

// Helper: get transactions with category relations for a date range
async function getTransactionsForRange(startDate: string, endDate: string) {
  return transactionRepository.find({
    where: {
      date: Between(new Date(startDate), new Date(endDate)),
    },
    relations: ['category'],
    order: { date: 'ASC' },
  });
}

// Helper: get all transactions before a date (for opening balance)
async function getTransactionsBefore(date: string) {
  return transactionRepository.find({
    where: {
      date: LessThanOrEqual(new Date(date)),
    },
  });
}

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
    // Default: current year
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  return { startDate, endDate };
}

// Categorize transactions by group
function categorizeByGroup(transactions: Transaction[]) {
  const groups: Record<string, { income: number; expense: number; items: { name: string; amount: number; type: string }[] }> = {
    operating_income: { income: 0, expense: 0, items: [] },
    cogs: { income: 0, expense: 0, items: [] },
    operating_expense: { income: 0, expense: 0, items: [] },
    investing: { income: 0, expense: 0, items: [] },
    financing: { income: 0, expense: 0, items: [] },
    other: { income: 0, expense: 0, items: [] },
  };

  for (const t of transactions) {
    const group = t.category?.group || CategoryGroup.OTHER;
    const amount = Number(t.amount);
    const categoryName = t.category?.name || 'Без категории';

    if (!groups[group]) {
      groups[group] = { income: 0, expense: 0, items: [] };
    }

    if (t.type === TransactionType.INCOME) {
      groups[group].income += amount;
    } else {
      groups[group].expense += amount;
    }

    // Aggregate by category name
    const existing = groups[group].items.find((i) => i.name === categoryName && i.type === t.type);
    if (existing) {
      existing.amount += amount;
    } else {
      groups[group].items.push({ name: categoryName, amount, type: t.type });
    }
  }

  return groups;
}

export const financialReportController = {
  // ===== БДДС (Cash Flow Statement) =====
  async getCashFlow(req: Request, res: Response) {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const period = (req.query.period as string) || 'monthly';
      const value = req.query.value ? parseInt(req.query.value as string) : undefined;

      const { startDate, endDate } = getPeriodBounds(year, period, value);

      // Opening balance: all transactions before startDate
      const prevTransactions = await transactionRepository.find({
        where: { date: LessThanOrEqual(new Date(new Date(startDate).getTime() - 86400000)) },
      });

      let openingBalance = 0;
      for (const t of prevTransactions) {
        if (t.type === TransactionType.INCOME) openingBalance += Number(t.amount);
        else openingBalance -= Number(t.amount);
      }

      // Period transactions
      const transactions = await getTransactionsForRange(startDate, endDate);
      const groups = categorizeByGroup(transactions);

      // Operating activity
      const operatingInflow = groups.operating_income.income + groups.other.income;
      const operatingOutflow = groups.cogs.expense + groups.operating_expense.expense + groups.other.expense;
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
                ...groups.operating_income.items.filter((i) => i.type === 'income'),
                ...groups.other.items.filter((i) => i.type === 'income'),
              ],
              expense: [
                ...groups.cogs.items.filter((i) => i.type === 'expense'),
                ...groups.operating_expense.items.filter((i) => i.type === 'expense'),
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
              income: groups.investing.items.filter((i) => i.type === 'income'),
              expense: groups.investing.items.filter((i) => i.type === 'expense'),
            },
          },
          financing: {
            label: 'Финансовая деятельность',
            inflow: financingInflow,
            outflow: financingOutflow,
            net: financingNet,
            details: {
              income: groups.financing.items.filter((i) => i.type === 'income'),
              expense: groups.financing.items.filter((i) => i.type === 'expense'),
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
        return res.status(400).json({ error: 'Необходимо указать startDate и endDate' });
      }

      const transactions = await getTransactionsForRange(startDate, endDate);
      const groups = categorizeByGroup(transactions);

      // Revenue (operating income)
      const revenue = groups.operating_income.income;
      const revenueDetails = groups.operating_income.items.filter((i) => i.type === 'income');

      // COGS
      const cogs = groups.cogs.expense;
      const cogsDetails = groups.cogs.items.filter((i) => i.type === 'expense');

      // Gross profit
      const grossProfit = revenue - cogs;

      // Operating expenses
      const operatingExpenses = groups.operating_expense.expense;
      const opexDetails = groups.operating_expense.items.filter((i) => i.type === 'expense');

      // Operating profit (EBIT)
      const operatingProfit = grossProfit - operatingExpenses;

      // Other income / expenses
      const otherIncome = groups.other.income + groups.investing.income + groups.financing.income;
      const otherExpenses = groups.other.expense + groups.investing.expense + groups.financing.expense;
      const otherNet = otherIncome - otherExpenses;

      const otherDetails = [
        ...groups.other.items,
        ...groups.investing.items,
        ...groups.financing.items,
      ];

      // Net profit
      const netProfit = operatingProfit + otherNet;

      // Margins
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
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
        other: { income: otherIncome, expenses: otherExpenses, net: otherNet, details: otherDetails },
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
      const asOfDate = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const transactions = await transactionRepository.find({
        where: { date: LessThanOrEqual(new Date(asOfDate)) },
      });

      let totalIncome = 0;
      let totalExpense = 0;

      for (const t of transactions) {
        if (t.type === TransactionType.INCOME) totalIncome += Number(t.amount);
        else totalExpense += Number(t.amount);
      }

      const cash = totalIncome - totalExpense;

      res.json({
        date: asOfDate,
        assets: {
          total: cash,
          items: [
            { name: 'Денежные средства', amount: cash },
          ],
        },
        liabilities: {
          total: 0,
          items: [],
        },
        equity: {
          total: cash,
          items: [
            { name: 'Нераспределённая прибыль', amount: cash },
          ],
        },
      });
    } catch (error) {
      console.error('Ошибка баланса:', error);
      res.status(500).json({ error: 'Ошибка при формировании баланса' });
    }
  },
};
