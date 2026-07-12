import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WbFinancialStat } from '../entities/WbFinancialStat';
import { wbApiService } from '../services/wb-api.service';
import { syncWbFinance } from '../services/wb-finance-sync.service';
import { weeklyFinance } from '../services/wb-weekly-finance.service';
import { saveWbApiToken } from '../services/settings.service';
import { round } from '../utils/math';

const repo = () => AppDataSource.getRepository(WbFinancialStat);

/**
 * POST /api/wb-finance/sync
 * Body: { startDate, endDate }
 * Fetches reportDetailByPeriod → aggregates by (date, nm_id) → upsert into DB
 */
export const syncStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }
    const { synced, rawRows } = await syncWbFinance(startDate, endDate);
    if (rawRows === 0) return res.json({ synced: 0, message: 'Нет данных за период' });
    res.json({ synced, rawRows, message: `Синхронизировано ${synced} записей` });
  } catch (error: any) {
    console.error('WB Finance sync error:', error);
    res.status(500).json({ error: error.message || 'Ошибка синхронизации' });
  }
};

/**
 * GET /api/wb-finance/weekly?start=YYYY-MM-DD — «Финансовые показатели недели»
 * (start = понедельник; по умолчанию — текущая неделя).
 */
export const getWeekly = async (req: Request, res: Response) => {
  try {
    let start = String(req.query.start || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      const d = new Date();
      const dow = (d.getUTCDay() + 6) % 7; // пн=0
      d.setUTCDate(d.getUTCDate() - dow);
      start = d.toISOString().slice(0, 10);
    }
    res.json(await weeklyFinance(start));
  } catch (error: any) {
    console.error('WB weekly finance error:', error);
    res.status(500).json({ error: error.message || 'Ошибка недельной сводки' });
  }
};

/**
 * GET /api/wb-finance/sync-status
 */
export const getSyncStatus = async (_req: Request, res: Response) => {
  try {
    const result = await repo()
      .createQueryBuilder('s')
      .select('MAX(s.date)', 'lastDate')
      .addSelect('MIN(s.date)', 'firstDate')
      .addSelect('COUNT(DISTINCT s.date)', 'daysCount')
      .getRawOne();

    res.json({
      lastDate: result?.lastDate || null,
      firstDate: result?.firstDate || null,
      daysCount: parseInt(result?.daysCount || '0'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/wb-finance/analytics
 * Params: startDate, endDate, nmId?, groupBy? (day|week)
 * Returns columnar format optimized for pivot table
 */
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, nmId, groupBy } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    const isWeekly = groupBy === 'week';

    // Build query
    const dateExpr = isWeekly
      ? `date_trunc('week', s.date)::date`
      : `s.date`;

    let qb = repo()
      .createQueryBuilder('s')
      .select(dateExpr, 'date')
      .addSelect('SUM(s.buyouts_sum)', 'buyouts_sum')
      .addSelect('SUM(s.transfer_amount)', 'transfer_amount')
      .addSelect('SUM(s.logistics_cost)', 'logistics_cost')
      .addSelect('SUM(s.storage_cost)', 'storage_cost')
      .addSelect('SUM(s.other_costs)', 'other_costs')
      .addSelect('SUM(s.acceptance_cost)', 'acceptance_cost')
      .addSelect('SUM(s.returns_count)', 'returns_count')
      .addSelect('SUM(s.returns_sum)', 'returns_sum')
      .addSelect('SUM(s.sales_count)', 'sales_count')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .groupBy(dateExpr)
      .orderBy(dateExpr, 'ASC');

    if (nmId) {
      qb = qb.andWhere('s.nm_id = :nmId', { nmId: Number(nmId) });
    }

    const rawRows = await qb.getRawMany();

    // Build columnar response
    const dates: string[] = [];
    const metrics: Record<string, number[]> = {
      buyouts_sum: [],
      transfer_amount: [],
      logistics_cost: [],
      storage_cost: [],
      other_costs: [],
      acceptance_cost: [],
      returns_sum: [],
      sales_count: [],
      returns_count: [],
      // Calculated
      commission: [],      // buyouts_sum - transfer_amount
      total_deducted: [],  // logistics + storage + other + acceptance
      net_payout: [],      // transfer_amount (what seller actually gets)
      // Percentages (of buyouts_sum)
      pct_transfer: [],
      pct_logistics: [],
      pct_storage: [],
      pct_other: [],
      pct_acceptance: [],
      pct_commission: [],
    };

    const totals: Record<string, number> = {};

    for (const row of rawRows) {
      const dateStr = typeof row.date === 'string'
        ? row.date.split('T')[0]
        : new Date(row.date).toISOString().split('T')[0];
      dates.push(dateStr);

      const bs = parseFloat(row.buyouts_sum) || 0;
      const ta = parseFloat(row.transfer_amount) || 0;
      const lc = parseFloat(row.logistics_cost) || 0;
      const sc = parseFloat(row.storage_cost) || 0;
      const oc = parseFloat(row.other_costs) || 0;
      const ac = parseFloat(row.acceptance_cost) || 0;
      const rs = parseFloat(row.returns_sum) || 0;
      const slc = parseFloat(row.sales_count) || 0;
      const rc = parseFloat(row.returns_count) || 0;

      const commission = bs - ta;
      const totalDeducted = lc + sc + oc + ac;

      metrics.buyouts_sum.push(round(bs));
      metrics.transfer_amount.push(round(ta));
      metrics.logistics_cost.push(round(lc));
      metrics.storage_cost.push(round(sc));
      metrics.other_costs.push(round(oc));
      metrics.acceptance_cost.push(round(ac));
      metrics.returns_sum.push(round(rs));
      metrics.sales_count.push(slc);
      metrics.returns_count.push(rc);
      metrics.commission.push(round(commission));
      metrics.total_deducted.push(round(totalDeducted));
      metrics.net_payout.push(round(ta));

      // Percentages
      metrics.pct_transfer.push(bs > 0 ? round(ta / bs * 100) : 0);
      metrics.pct_logistics.push(bs > 0 ? round(lc / bs * 100) : 0);
      metrics.pct_storage.push(bs > 0 ? round(sc / bs * 100) : 0);
      metrics.pct_other.push(bs > 0 ? round(oc / bs * 100) : 0);
      metrics.pct_acceptance.push(bs > 0 ? round(ac / bs * 100) : 0);
      metrics.pct_commission.push(bs > 0 ? round(commission / bs * 100) : 0);
    }

    // Compute totals
    const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const tBuyouts = sumArr(metrics.buyouts_sum);
    const tTransfer = sumArr(metrics.transfer_amount);
    const tLogistics = sumArr(metrics.logistics_cost);
    const tStorage = sumArr(metrics.storage_cost);
    const tOther = sumArr(metrics.other_costs);
    const tAcceptance = sumArr(metrics.acceptance_cost);
    const tReturnsSum = sumArr(metrics.returns_sum);
    const tReturnsCount = sumArr(metrics.returns_count);
    const tSalesCount = sumArr(metrics.sales_count);
    const tCommission = tBuyouts - tTransfer;
    const tTotalDeducted = tLogistics + tStorage + tOther + tAcceptance;

    Object.assign(totals, {
      buyouts_sum: round(tBuyouts),
      transfer_amount: round(tTransfer),
      logistics_cost: round(tLogistics),
      storage_cost: round(tStorage),
      other_costs: round(tOther),
      acceptance_cost: round(tAcceptance),
      returns_sum: round(tReturnsSum),
      sales_count: tSalesCount,
      returns_count: tReturnsCount,
      commission: round(tCommission),
      total_deducted: round(tTotalDeducted),
      net_payout: round(tTransfer),
      pct_transfer: tBuyouts > 0 ? round(tTransfer / tBuyouts * 100) : 0,
      pct_logistics: tBuyouts > 0 ? round(tLogistics / tBuyouts * 100) : 0,
      pct_storage: tBuyouts > 0 ? round(tStorage / tBuyouts * 100) : 0,
      pct_other: tBuyouts > 0 ? round(tOther / tBuyouts * 100) : 0,
      pct_acceptance: tBuyouts > 0 ? round(tAcceptance / tBuyouts * 100) : 0,
      pct_commission: tBuyouts > 0 ? round(tCommission / tBuyouts * 100) : 0,
    });

    // Distinct nm_ids for article tabs
    let nmIdsQb = repo()
      .createQueryBuilder('s')
      .select('s.nm_id', 'nm_id')
      .distinct(true)
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate });
    if (nmId) {
      nmIdsQb = nmIdsQb.andWhere('s.nm_id = :nmId', { nmId: Number(nmId) });
    }
    const nmIdsRows = await nmIdsQb.getRawMany();
    const nmIds = nmIdsRows.map(r => Number(r.nm_id));

    res.json({ dates, metrics, totals, nmIds });
  } catch (error: any) {
    console.error('WB Finance analytics error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/wb-finance/articles
 * Returns distinct nm_id + product_name
 */
export const getArticles = async (_req: Request, res: Response) => {
  try {
    const rows = await repo()
      .createQueryBuilder('s')
      .select('s.nm_id', 'nm_id')
      .addSelect('s.product_name', 'product_name')
      .distinct(true)
      .orderBy('s.nm_id', 'ASC')
      .getRawMany();

    const map = new Map<number, string>();
    for (const row of rows) {
      const nmId = Number(row.nm_id);
      if (!map.has(nmId) || (row.product_name && !map.get(nmId))) {
        map.set(nmId, row.product_name || '');
      }
    }

    const articles = Array.from(map.entries()).map(([nm_id, product_name]) => ({
      nm_id,
      product_name,
    }));

    res.json(articles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Token (shared with wb-ads, re-exposes for convenience) ───

export const getTokenStatus = async (_req: Request, res: Response) => {
  res.json({
    hasToken: wbApiService.hasToken(),
    maskedToken: wbApiService.getMaskedToken(),
  });
};

export const saveToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: 'Токен не может быть пустым' });
    }
    await saveWbApiToken(token.trim()); // персист в БД + применить (один токен на все WB-фичи)
    res.json({
      success: true,
      hasToken: true,
      maskedToken: wbApiService.getMaskedToken(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

