import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WbFinancialStat } from '../entities/WbFinancialStat';
import { wbApiService } from '../services/wb-api.service';

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

    const rows = await wbApiService.getReportDetailByPeriod(startDate, endDate);
    if (rows.length === 0) {
      return res.json({ synced: 0, message: 'Нет данных за период' });
    }

    // Aggregate per (date, nm_id)
    const map = new Map<string, {
      date: string;
      nm_id: number;
      product_name: string;
      buyouts_sum: number;
      transfer_amount: number;
      logistics_cost: number;
      storage_cost: number;
      other_costs: number;
      acceptance_cost: number;
      returns_count: number;
      returns_sum: number;
      sales_count: number;
    }>();

    for (const row of rows) {
      // Use sale_dt (sale date) for aggregation; fall back to rr_dt
      const dateStr = (row.sale_dt || row.rr_dt || '').split('T')[0];
      if (!dateStr || !row.nm_id) continue;

      const key = `${dateStr}_${row.nm_id}`;
      let agg = map.get(key);

      if (!agg) {
        agg = {
          date: dateStr,
          nm_id: row.nm_id,
          product_name: row.subject_name || '',
          buyouts_sum: 0,
          transfer_amount: 0,
          logistics_cost: 0,
          storage_cost: 0,
          other_costs: 0,
          acceptance_cost: 0,
          returns_count: 0,
          returns_sum: 0,
          sales_count: 0,
        };
        map.set(key, agg);
      }

      // Accumulate
      if (row.doc_type_name === 'Продажа') {
        agg.buyouts_sum += row.retail_amount || 0;
        agg.sales_count += row.quantity || 0;
      } else if (row.doc_type_name === 'Возврат') {
        agg.returns_count += Math.abs(row.quantity || 0);
        agg.returns_sum += Math.abs(row.retail_amount || 0);
      }

      agg.transfer_amount += row.ppvz_for_pay || 0;
      agg.logistics_cost += row.delivery_rub || 0;
      agg.storage_cost += row.storage_fee || 0;
      agg.acceptance_cost += row.acceptance || 0;
      agg.other_costs += (row.penalty || 0) + (row.additional_payment || 0)
        + (row.rebill_logistic_cost || 0) + (row.deduction || 0);

      if (!agg.product_name && row.subject_name) {
        agg.product_name = row.subject_name;
      }
    }

    const records = Array.from(map.values()).map(r => ({
      ...r,
      date: new Date(r.date),
      buyouts_sum: round(r.buyouts_sum),
      transfer_amount: round(r.transfer_amount),
      logistics_cost: round(r.logistics_cost),
      storage_cost: round(r.storage_cost),
      other_costs: round(r.other_costs),
      acceptance_cost: round(r.acceptance_cost),
      returns_sum: round(r.returns_sum),
    }));

    // Batch upsert
    let synced = 0;
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await repo()
        .createQueryBuilder()
        .insert()
        .into(WbFinancialStat)
        .values(batch)
        .orUpdate(
          [
            'product_name', 'buyouts_sum', 'transfer_amount',
            'logistics_cost', 'storage_cost', 'other_costs',
            'acceptance_cost', 'returns_count', 'returns_sum',
            'sales_count', 'updated_at',
          ],
          ['date', 'nm_id']
        )
        .execute();
      synced += batch.length;
    }

    res.json({ synced, rawRows: rows.length, message: `Синхронизировано ${synced} записей` });
  } catch (error: any) {
    console.error('WB Finance sync error:', error);
    res.status(500).json({ error: error.message || 'Ошибка синхронизации' });
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
    wbApiService.setToken(token.trim());
    res.json({
      success: true,
      hasToken: true,
      maskedToken: wbApiService.getMaskedToken(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Helpers ───

function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
