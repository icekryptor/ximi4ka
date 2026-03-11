import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DailySales } from '../entities/DailySales';
import { WbFinancialStat } from '../entities/WbFinancialStat';
import { WbAdStat } from '../entities/WbAdStat';
import { SkuMapping } from '../entities/SkuMapping';
import { Kit } from '../entities/Kit';
import { UnitEconomicsCalculation } from '../entities/UnitEconomicsCalculation';

const salesRepo = () => AppDataSource.getRepository(DailySales);

function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * GET /api/sales-report
 * Params: startDate, endDate, channel?, kitId?
 * Returns columnar format for pivot table
 */
export const getReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, channel, kitId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    let qb = salesRepo()
      .createQueryBuilder('s')
      .select('s.date', 'date')
      .addSelect('SUM(s.sales_count)', 'sales_count')
      .addSelect('SUM(s.total_revenue)', 'total_revenue')
      .addSelect('SUM(s.logistics_cost)', 'logistics_cost')
      .addSelect('SUM(s.storage_cost)', 'storage_cost')
      .addSelect('SUM(s.ad_spend)', 'ad_spend')
      .addSelect('SUM(s.other_costs)', 'other_costs')
      .addSelect('SUM(s.total_costs)', 'total_costs')
      .addSelect('SUM(s.profit)', 'profit')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .groupBy('s.date')
      .orderBy('s.date', 'ASC');

    if (channel) {
      qb = qb.andWhere('s.channel_name = :channel', { channel });
    }
    if (kitId) {
      qb = qb.andWhere('s.kit_id = :kitId', { kitId });
    }

    const rawRows = await qb.getRawMany();

    // Build columnar response
    const dates: string[] = [];
    const metrics: Record<string, number[]> = {
      revenue_per_unit: [],
      sales_count: [],
      total_revenue: [],
      logistics_cost: [],
      storage_cost: [],
      ad_spend: [],
      other_costs: [],
      profit: [],
      margin: [],
    };

    for (const row of rawRows) {
      const dateStr = typeof row.date === 'string'
        ? row.date.split('T')[0]
        : new Date(row.date).toISOString().split('T')[0];
      dates.push(dateStr);

      const sc = parseInt(row.sales_count) || 0;
      const tr = parseFloat(row.total_revenue) || 0;
      const lc = parseFloat(row.logistics_cost) || 0;
      const stc = parseFloat(row.storage_cost) || 0;
      const ad = parseFloat(row.ad_spend) || 0;
      const oc = parseFloat(row.other_costs) || 0;
      const profit = parseFloat(row.profit) || 0;

      const rpu = sc > 0 ? round(tr / sc) : 0;
      const margin = tr > 0 ? round(profit / tr * 100) : 0;

      metrics.revenue_per_unit.push(rpu);
      metrics.sales_count.push(sc);
      metrics.total_revenue.push(round(tr));
      metrics.logistics_cost.push(round(lc));
      metrics.storage_cost.push(round(stc));
      metrics.ad_spend.push(round(ad));
      metrics.other_costs.push(round(oc));
      metrics.profit.push(round(profit));
      metrics.margin.push(margin);
    }

    // Compute totals
    const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const tSalesCount = sumArr(metrics.sales_count);
    const tTotalRevenue = sumArr(metrics.total_revenue);
    const tLogistics = sumArr(metrics.logistics_cost);
    const tStorage = sumArr(metrics.storage_cost);
    const tAdSpend = sumArr(metrics.ad_spend);
    const tOtherCosts = sumArr(metrics.other_costs);
    const tProfit = sumArr(metrics.profit);

    const totals: Record<string, number> = {
      revenue_per_unit: tSalesCount > 0 ? round(tTotalRevenue / tSalesCount) : 0,
      sales_count: tSalesCount,
      total_revenue: round(tTotalRevenue),
      logistics_cost: round(tLogistics),
      storage_cost: round(tStorage),
      ad_spend: round(tAdSpend),
      other_costs: round(tOtherCosts),
      profit: round(tProfit),
      margin: tTotalRevenue > 0 ? round(tProfit / tTotalRevenue * 100) : 0,
    };

    // Get kits used in this period
    let kitsQb = salesRepo()
      .createQueryBuilder('s')
      .select('DISTINCT s.kit_id', 'kit_id')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate });
    if (channel) kitsQb = kitsQb.andWhere('s.channel_name = :channel', { channel });
    if (kitId) kitsQb = kitsQb.andWhere('s.kit_id = :kitId', { kitId });

    const kitIds = (await kitsQb.getRawMany()).map(r => r.kit_id);
    let kits: Array<{ id: string; name: string; seller_sku: string | null }> = [];
    if (kitIds.length > 0) {
      const kitRepo = AppDataSource.getRepository(Kit);
      const kitRecords = await kitRepo
        .createQueryBuilder('k')
        .select(['k.id', 'k.name', 'k.seller_sku'])
        .where('k.id IN (:...ids)', { ids: kitIds })
        .getMany();
      kits = kitRecords.map(k => ({ id: k.id, name: k.name, seller_sku: k.seller_sku }));
    }

    // Get channels used
    let channelsQb = salesRepo()
      .createQueryBuilder('s')
      .select('DISTINCT s.channel_name', 'channel_name')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate });
    if (kitId) channelsQb = channelsQb.andWhere('s.kit_id = :kitId', { kitId });
    const channels = (await channelsQb.getRawMany()).map(r => r.channel_name);

    res.json({ dates, metrics, totals, kits, channels });
  } catch (error: any) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения отчёта' });
  }
};

/**
 * GET /api/sales-report/summary
 * Params: startDate, endDate
 * Returns aggregated summary by channel
 */
export const getSummary = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    const rows = await salesRepo()
      .createQueryBuilder('s')
      .select('s.channel_name', 'channel_name')
      .addSelect('SUM(s.total_revenue)', 'total_revenue')
      .addSelect('SUM(s.profit)', 'total_profit')
      .addSelect('SUM(s.sales_count)', 'total_sales')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .groupBy('s.channel_name')
      .getRawMany();

    const channels = rows.map(r => {
      const revenue = parseFloat(r.total_revenue) || 0;
      const profit = parseFloat(r.total_profit) || 0;
      return {
        channel_name: r.channel_name,
        total_revenue: round(revenue),
        total_profit: round(profit),
        avg_margin: revenue > 0 ? round(profit / revenue * 100) : 0,
        total_sales: parseInt(r.total_sales) || 0,
      };
    });

    res.json({ channels, period: { startDate, endDate } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/sales-report/sync-wb
 * Body: { startDate, endDate }
 * Syncs data from WbFinancialStat + WbAdStat → daily_sales
 */
export const syncFromWb = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    const wbFinRepo = AppDataSource.getRepository(WbFinancialStat);
    const wbAdRepo = AppDataSource.getRepository(WbAdStat);
    const skuRepo = AppDataSource.getRepository(SkuMapping);
    const kitRepo = AppDataSource.getRepository(Kit);
    const ueRepo = AppDataSource.getRepository(UnitEconomicsCalculation);

    // 1. Load all sku mappings with kit relations
    const skuMappings = await skuRepo.find({ relations: ['kit'] });
    const skuMap = new Map<string, SkuMapping>();
    for (const m of skuMappings) {
      if (m.kit_id) {
        skuMap.set(m.marketplace_sku, m);
      }
    }

    // 2. Load WB financial stats for the period
    const wbFinStats = await wbFinRepo
      .createQueryBuilder('s')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .getMany();

    if (wbFinStats.length === 0) {
      return res.json({ synced: 0, unmapped: [], message: 'Нет финансовых данных WB за период' });
    }

    // 3. Load WB ad stats for the period, aggregate by (date, nm_id)
    const wbAdStats = await wbAdRepo
      .createQueryBuilder('a')
      .select('a.date', 'date')
      .addSelect('a.nm_id', 'nm_id')
      .addSelect('SUM(a.ad_spend)', 'ad_spend')
      .where('a.date >= :startDate', { startDate })
      .andWhere('a.date <= :endDate', { endDate })
      .groupBy('a.date')
      .addGroupBy('a.nm_id')
      .getRawMany();

    const adSpendMap = new Map<string, number>();
    for (const row of wbAdStats) {
      const dateStr = typeof row.date === 'string'
        ? row.date.split('T')[0]
        : new Date(row.date).toISOString().split('T')[0];
      const key = `${dateStr}_${row.nm_id}`;
      adSpendMap.set(key, parseFloat(row.ad_spend) || 0);
    }

    // 4. Load unit economics calculations for WB channel → get cost_type per kit
    const ueCalcs = await ueRepo.find({
      where: { channel_name: 'ВБ' },
    });
    const costTypeMap = new Map<string, string>();
    for (const calc of ueCalcs) {
      // Use the latest (last in array) if multiple
      costTypeMap.set(calc.kit_id, calc.cost_type);
    }

    // 5. Build daily_sales records
    const unmappedNmIds = new Set<number>();
    const recordsMap = new Map<string, DailySales>();

    for (const stat of wbFinStats) {
      const nmIdStr = String(stat.nm_id);
      const mapping = skuMap.get(nmIdStr);

      if (!mapping || !mapping.kit) {
        unmappedNmIds.add(stat.nm_id);
        continue;
      }

      const kit = mapping.kit;
      const dateStr = typeof stat.date === 'string'
        ? (stat.date as string).split('T')[0]
        : new Date(stat.date).toISOString().split('T')[0];

      const key = `${dateStr}_${kit.id}`;
      let record = recordsMap.get(key);

      if (!record) {
        // Determine cost price
        const costType = costTypeMap.get(kit.id) || 'estimated';
        const costPrice = costType === 'estimated'
          ? Number(kit.estimated_cost || 0)
          : Number(kit.total_cost || 0);

        record = new DailySales();
        record.date = new Date(dateStr);
        record.channel_name = 'ВБ';
        record.kit_id = kit.id;
        record.source = 'wb_sync';
        record.sales_count = 0;
        record.revenue_per_unit = 0;
        record.total_revenue = 0;
        record.cost_price_per_unit = costPrice;
        record.logistics_cost = 0;
        record.storage_cost = 0;
        record.ad_spend = 0;
        record.other_costs = 0;
        record.total_costs = 0;
        record.profit = 0;
        record.margin = 0;
        recordsMap.set(key, record);
      }

      // Aggregate across nm_ids that map to the same kit
      record.sales_count += stat.sales_count || 0;
      record.total_revenue += Number(stat.buyouts_sum) || 0;
      record.logistics_cost += Number(stat.logistics_cost) || 0;
      record.storage_cost += Number(stat.storage_cost) || 0;
      record.other_costs += Number(stat.other_costs) + Number(stat.acceptance_cost) || 0;

      // Ad spend per nm_id per date
      const adKey = `${dateStr}_${stat.nm_id}`;
      record.ad_spend += adSpendMap.get(adKey) || 0;
    }

    // 6. Calculate derived fields and prepare for upsert
    const records: any[] = [];
    for (const record of recordsMap.values()) {
      record.total_revenue = round(record.total_revenue);
      record.logistics_cost = round(record.logistics_cost);
      record.storage_cost = round(record.storage_cost);
      record.ad_spend = round(record.ad_spend);
      record.other_costs = round(record.other_costs);

      record.revenue_per_unit = record.sales_count > 0
        ? round(record.total_revenue / record.sales_count)
        : 0;

      record.total_costs = round(
        (record.cost_price_per_unit * record.sales_count)
        + record.logistics_cost
        + record.storage_cost
        + record.ad_spend
        + record.other_costs
      );

      record.profit = round(record.total_revenue - record.total_costs);
      record.margin = record.total_revenue > 0
        ? round(record.profit / record.total_revenue * 100)
        : 0;

      records.push({
        date: record.date,
        channel_name: record.channel_name,
        kit_id: record.kit_id,
        source: record.source,
        sales_count: record.sales_count,
        revenue_per_unit: record.revenue_per_unit,
        total_revenue: record.total_revenue,
        cost_price_per_unit: record.cost_price_per_unit,
        logistics_cost: record.logistics_cost,
        storage_cost: record.storage_cost,
        ad_spend: record.ad_spend,
        other_costs: record.other_costs,
        total_costs: record.total_costs,
        profit: record.profit,
        margin: record.margin,
      });
    }

    // 7. Batch upsert
    let synced = 0;
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await salesRepo()
        .createQueryBuilder()
        .insert()
        .into(DailySales)
        .values(batch)
        .orUpdate(
          [
            'source', 'sales_count', 'revenue_per_unit', 'total_revenue',
            'cost_price_per_unit', 'logistics_cost', 'storage_cost',
            'ad_spend', 'other_costs', 'total_costs', 'profit', 'margin',
            'updated_at',
          ],
          ['date', 'channel_name', 'kit_id']
        )
        .execute();
      synced += batch.length;
    }

    res.json({
      synced,
      unmapped: Array.from(unmappedNmIds),
      message: `Синхронизировано ${synced} записей`,
    });
  } catch (error: any) {
    console.error('Sales report WB sync error:', error);
    res.status(500).json({ error: error.message || 'Ошибка синхронизации' });
  }
};

/**
 * POST /api/sales-report
 * Body: { date, channel_name, kit_id, sales_count, revenue_per_unit, logistics_cost, storage_cost, ad_spend, other_costs }
 * Creates or updates a manual entry
 */
export const createOrUpdate = async (req: Request, res: Response) => {
  try {
    const {
      date,
      channel_name,
      kit_id,
      sales_count = 0,
      revenue_per_unit = 0,
      logistics_cost = 0,
      storage_cost = 0,
      ad_spend = 0,
      other_costs = 0,
    } = req.body;

    if (!date || !channel_name || !kit_id) {
      return res.status(400).json({ error: 'date, channel_name и kit_id обязательны' });
    }

    // Get kit for cost price
    const kitRepo = AppDataSource.getRepository(Kit);
    const kit = await kitRepo.findOne({ where: { id: kit_id } });
    if (!kit) {
      return res.status(404).json({ error: 'Набор не найден' });
    }

    // Determine cost price from unit economics or kit
    const ueRepo = AppDataSource.getRepository(UnitEconomicsCalculation);
    const ueCalc = await ueRepo.findOne({
      where: { kit_id, channel_name },
      order: { updated_at: 'DESC' },
    });

    const costType = ueCalc?.cost_type || 'estimated';
    const costPricePerUnit = costType === 'estimated'
      ? Number(kit.estimated_cost || 0)
      : Number(kit.total_cost || 0);

    const totalRevenue = round(Number(sales_count) * Number(revenue_per_unit));
    const totalCosts = round(
      (costPricePerUnit * Number(sales_count))
      + Number(logistics_cost)
      + Number(storage_cost)
      + Number(ad_spend)
      + Number(other_costs)
    );
    const profit = round(totalRevenue - totalCosts);
    const margin = totalRevenue > 0 ? round(profit / totalRevenue * 100) : 0;

    // Check if entry exists
    const existing = await salesRepo().findOne({
      where: { date: new Date(date), channel_name, kit_id },
    });

    if (existing) {
      await salesRepo().update(existing.id, {
        sales_count: Number(sales_count),
        revenue_per_unit: Number(revenue_per_unit),
        total_revenue: totalRevenue,
        cost_price_per_unit: costPricePerUnit,
        logistics_cost: Number(logistics_cost),
        storage_cost: Number(storage_cost),
        ad_spend: Number(ad_spend),
        other_costs: Number(other_costs),
        total_costs: totalCosts,
        profit,
        margin,
        source: 'manual',
      });

      const updated = await salesRepo().findOne({
        where: { id: existing.id },
        relations: ['kit'],
      });
      return res.json(updated);
    }

    const entry = salesRepo().create({
      date: new Date(date),
      channel_name,
      kit_id,
      source: 'manual',
      sales_count: Number(sales_count),
      revenue_per_unit: Number(revenue_per_unit),
      total_revenue: totalRevenue,
      cost_price_per_unit: costPricePerUnit,
      logistics_cost: Number(logistics_cost),
      storage_cost: Number(storage_cost),
      ad_spend: Number(ad_spend),
      other_costs: Number(other_costs),
      total_costs: totalCosts,
      profit,
      margin,
    });

    const saved = await salesRepo().save(entry);
    const full = await salesRepo().findOne({
      where: { id: saved.id },
      relations: ['kit'],
    });

    res.status(201).json(full);
  } catch (error: any) {
    console.error('Sales report create error:', error);
    res.status(500).json({ error: error.message || 'Ошибка создания записи' });
  }
};

/**
 * DELETE /api/sales-report/:id
 */
export const deleteEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await salesRepo().delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json({ message: 'Запись удалена' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/sales-report/entries
 * Returns individual entries (not aggregated) for editing
 * Params: startDate, endDate, channel?, kitId?
 */
export const getEntries = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, channel, kitId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    let qb = salesRepo()
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.kit', 'kit')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .orderBy('s.date', 'DESC');

    if (channel) qb = qb.andWhere('s.channel_name = :channel', { channel });
    if (kitId) qb = qb.andWhere('s.kit_id = :kitId', { kitId });

    const entries = await qb.getMany();
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
