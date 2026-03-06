import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { WbAdStat } from '../entities/WbAdStat';
import { WbAdNote } from '../entities/WbAdNote';
import { wbApiService } from '../services/wb-api.service';

const statsRepo = () => AppDataSource.getRepository(WbAdStat);
const notesRepo = () => AppDataSource.getRepository(WbAdNote);

/**
 * POST /api/wb-ads/sync
 * Body: { startDate, endDate }
 * Fetches campaigns → fullstats → upsert into DB
 */
export const syncStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    // 1. Get all campaigns
    const campaigns = await wbApiService.getCampaigns();
    if (campaigns.length === 0) {
      return res.json({ synced: 0, message: 'Нет активных кампаний' });
    }

    // Build campaign info map
    const campaignMap = new Map<number, { type: number; status: number }>();
    for (const c of campaigns) {
      campaignMap.set(c.advertId, { type: c.type, status: c.status });
    }

    // 2. Get fullstats
    const campaignIds = campaigns.map(c => c.advertId);
    const stats = await wbApiService.getFullStats(campaignIds, startDate, endDate);

    // 3. Flatten to rows and aggregate duplicates (same date+campaign+nmId across appTypes)
    const rowMap = new Map<string, Partial<WbAdStat>>();
    for (const campaign of stats) {
      const info = campaignMap.get(campaign.advertId);
      if (!campaign.days) continue;

      for (const day of campaign.days) {
        for (const app of day.apps) {
          for (const nm of app.nms) {
            const key = `${day.date}_${campaign.advertId}_${nm.nmId}`;
            const existing = rowMap.get(key);

            if (existing) {
              // Aggregate metrics from different appTypes
              existing.views = (existing.views || 0) + (nm.views || 0);
              existing.clicks = (existing.clicks || 0) + (nm.clicks || 0);
              existing.atbs = (existing.atbs || 0) + (nm.atbs || 0);
              existing.orders_count = (existing.orders_count || 0) + (nm.orders || 0);
              existing.orders_sum = (existing.orders_sum || 0) + (nm.sum_price || 0);
              existing.shks = (existing.shks || 0) + (nm.shks || 0);
              existing.ad_spend = (existing.ad_spend || 0) + (nm.sum || 0);
              existing.canceled = (existing.canceled || 0) + (nm.canceled || 0);
              // Recalculate derived
              existing.ctr = existing.views! > 0 ? round(existing.clicks! / existing.views! * 100) : 0;
              existing.cpc = existing.clicks! > 0 ? round(existing.ad_spend! / existing.clicks!) : 0;
              if (!existing.product_name && nm.name) existing.product_name = nm.name;
            } else {
              rowMap.set(key, {
                date: new Date(day.date),
                campaign_id: campaign.advertId,
                campaign_type: info?.type ?? undefined,
                nm_id: nm.nmId,
                product_name: nm.name || undefined,
                views: nm.views || 0,
                clicks: nm.clicks || 0,
                ctr: nm.ctr || 0,
                cpc: nm.cpc || 0,
                atbs: nm.atbs || 0,
                orders_count: nm.orders || 0,
                orders_sum: nm.sum_price || 0,
                shks: nm.shks || 0,
                ad_spend: nm.sum || 0,
                canceled: nm.canceled || 0,
              });
            }
          }
        }
      }
    }
    const rows = Array.from(rowMap.values());

    // Batch upsert (500 at a time)
    let synced = 0;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await statsRepo()
        .createQueryBuilder()
        .insert()
        .into(WbAdStat)
        .values(batch)
        .orUpdate(
          [
            'campaign_name', 'campaign_type', 'product_name',
            'views', 'clicks', 'ctr', 'cpc', 'atbs',
            'orders_count', 'orders_sum', 'shks', 'ad_spend', 'canceled',
            'updated_at',
          ],
          ['date', 'campaign_id', 'nm_id']
        )
        .execute();
      synced += batch.length;
    }

    res.json({ synced, campaigns: campaigns.length, message: `Синхронизировано ${synced} записей` });
  } catch (error: any) {
    console.error('WB Ads sync error:', error);
    res.status(500).json({ error: error.message || 'Ошибка синхронизации' });
  }
};

/**
 * GET /api/wb-ads/sync-status
 * Returns last sync date and total count
 */
export const getSyncStatus = async (_req: Request, res: Response) => {
  try {
    const result = await statsRepo()
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
    console.error('WB Ads sync status error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/wb-ads/analytics
 * Params: startDate, endDate, nmId? (filter by article)
 * Returns columnar format optimized for pivot table
 */
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, nmId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate и endDate обязательны' });
    }

    let qb = statsRepo()
      .createQueryBuilder('s')
      .select('s.date', 'date')
      .addSelect('SUM(s.views)', 'views')
      .addSelect('SUM(s.clicks)', 'clicks')
      .addSelect('SUM(s.atbs)', 'atbs')
      .addSelect('SUM(s.orders_count)', 'orders_count')
      .addSelect('SUM(s.orders_sum)', 'orders_sum')
      .addSelect('SUM(s.shks)', 'shks')
      .addSelect('SUM(s.ad_spend)', 'ad_spend')
      .addSelect('SUM(s.canceled)', 'canceled')
      .addSelect('SUM(s.buyouts_count)', 'buyouts_count')
      .addSelect('SUM(s.buyouts_sum)', 'buyouts_sum')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate })
      .groupBy('s.date')
      .orderBy('s.date', 'ASC');

    if (nmId) {
      qb = qb.andWhere('s.nm_id = :nmId', { nmId: Number(nmId) });
    }

    const rawRows = await qb.getRawMany();

    // Build columnar response
    const dates: string[] = [];
    const metrics: Record<string, number[]> = {
      views: [], clicks: [], atbs: [],
      orders_count: [], orders_sum: [],
      buyouts_count: [], buyouts_sum: [],
      ad_spend: [],
      ctr: [], cpc: [], cpo: [], cpm: [],
      drr_orders: [], drr_buyouts: [],
      cr_to_cart: [], cr_to_order: [],
    };

    const totals: Record<string, number> = {
      views: 0, clicks: 0, atbs: 0,
      orders_count: 0, orders_sum: 0,
      buyouts_count: 0, buyouts_sum: 0,
      ad_spend: 0,
    };

    for (const row of rawRows) {
      const dateStr = typeof row.date === 'string'
        ? row.date.split('T')[0]
        : new Date(row.date).toISOString().split('T')[0];
      dates.push(dateStr);

      const v = parseFloat(row.views) || 0;
      const cl = parseFloat(row.clicks) || 0;
      const atb = parseFloat(row.atbs) || 0;
      const oc = parseFloat(row.orders_count) || 0;
      const os = parseFloat(row.orders_sum) || 0;
      const bc = parseFloat(row.buyouts_count) || 0;
      const bs = parseFloat(row.buyouts_sum) || 0;
      const spend = parseFloat(row.ad_spend) || 0;

      metrics.views.push(v);
      metrics.clicks.push(cl);
      metrics.atbs.push(atb);
      metrics.orders_count.push(oc);
      metrics.orders_sum.push(os);
      metrics.buyouts_count.push(bc);
      metrics.buyouts_sum.push(bs);
      metrics.ad_spend.push(spend);

      // Calculated metrics
      metrics.ctr.push(v > 0 ? round(cl / v * 100) : 0);
      metrics.cpc.push(cl > 0 ? round(spend / cl) : 0);
      metrics.cpo.push(oc > 0 ? round(spend / oc) : 0);
      metrics.cpm.push(v > 0 ? round(spend / v * 1000) : 0);
      metrics.drr_orders.push(os > 0 ? round(spend / os * 100) : 0);
      metrics.drr_buyouts.push(bs > 0 ? round(spend / bs * 100) : 0);
      metrics.cr_to_cart.push(cl > 0 ? round(atb / cl * 100) : 0);
      metrics.cr_to_order.push(cl > 0 ? round(oc / cl * 100) : 0);

      // Accumulate totals
      totals.views += v;
      totals.clicks += cl;
      totals.atbs += atb;
      totals.orders_count += oc;
      totals.orders_sum += os;
      totals.buyouts_count += bc;
      totals.buyouts_sum += bs;
      totals.ad_spend += spend;
    }

    // Calculate totals for derived metrics
    const calculatedTotals: Record<string, number> = {
      ...totals,
      ctr: totals.views > 0 ? round(totals.clicks / totals.views * 100) : 0,
      cpc: totals.clicks > 0 ? round(totals.ad_spend / totals.clicks) : 0,
      cpo: totals.orders_count > 0 ? round(totals.ad_spend / totals.orders_count) : 0,
      cpm: totals.views > 0 ? round(totals.ad_spend / totals.views * 1000) : 0,
      drr_orders: totals.orders_sum > 0 ? round(totals.ad_spend / totals.orders_sum * 100) : 0,
      drr_buyouts: totals.buyouts_sum > 0 ? round(totals.ad_spend / totals.buyouts_sum * 100) : 0,
      cr_to_cart: totals.clicks > 0 ? round(totals.atbs / totals.clicks * 100) : 0,
      cr_to_order: totals.clicks > 0 ? round(totals.orders_count / totals.clicks * 100) : 0,
    };

    // Get distinct nmIds for the period
    let nmIdsQb = statsRepo()
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

    res.json({ dates, metrics, totals: calculatedTotals, nmIds });
  } catch (error: any) {
    console.error('WB Ads analytics error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/wb-ads/articles
 * Returns distinct nm_id + product_name
 */
export const getArticles = async (_req: Request, res: Response) => {
  try {
    const rows = await statsRepo()
      .createQueryBuilder('s')
      .select('s.nm_id', 'nm_id')
      .addSelect('s.product_name', 'product_name')
      .distinct(true)
      .orderBy('s.nm_id', 'ASC')
      .getRawMany();

    // Deduplicate by nm_id (take first non-null product_name)
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
    console.error('WB Ads articles error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── Notes CRUD ───

export const getNotes = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let qb = notesRepo().createQueryBuilder('n').orderBy('n.date', 'ASC');

    if (startDate) qb = qb.andWhere('n.date >= :startDate', { startDate });
    if (endDate) qb = qb.andWhere('n.date <= :endDate', { endDate });

    const notes = await qb.getMany();
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createNote = async (req: Request, res: Response) => {
  try {
    const { date, content } = req.body;
    if (!date || !content) {
      return res.status(400).json({ error: 'date и content обязательны' });
    }
    const note = notesRepo().create({ date, content });
    await notesRepo().save(note);
    res.status(201).json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const note = await notesRepo().findOneBy({ id: req.params.id });
    if (!note) return res.status(404).json({ error: 'Заметка не найдена' });

    note.content = req.body.content ?? note.content;
    await notesRepo().save(note);
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const result = await notesRepo().delete(req.params.id);
    if (result.affected === 0) return res.status(404).json({ error: 'Заметка не найдена' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Token Management ───

/**
 * GET /api/wb-ads/token/status
 * Returns whether token is set and masked version
 */
export const getTokenStatus = async (_req: Request, res: Response) => {
  try {
    res.json({
      hasToken: wbApiService.hasToken(),
      maskedToken: wbApiService.getMaskedToken(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/wb-ads/token
 * Body: { token }
 * Saves WB API token at runtime
 */
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
