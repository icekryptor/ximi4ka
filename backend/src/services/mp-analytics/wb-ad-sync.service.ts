/**
 * Автосинк рекламы WB: (1) fetch advert-api /fullstats → wb_ad_stats,
 * (2) маппер wb_ad_stats → mp_ad_daily (Поиск=типы 6/9 → 'au', Полки=прочие → 'apk').
 */
import { AppDataSource } from '../../config/database';
import { WbAdStat } from '../../entities/WbAdStat';
import { wbApiService } from '../wb-api.service';
import { round } from '../../utils/math';
import { importAdRows } from './mp-analytics.service';

const statsRepo = () => AppDataSource.getRepository(WbAdStat);

/** Фетч WB advert-api fullstats → wb_ad_stats за период. */
export async function refreshWbAdStats(startDate: string, endDate: string): Promise<number> {
  const campaigns = await wbApiService.getCampaigns();
  if (!campaigns.length) return 0;
  const typeById = new Map<number, number>();
  for (const c of campaigns) typeById.set(c.advertId, c.type);

  const stats = await wbApiService.getFullStats(campaigns.map((c) => c.advertId), startDate, endDate);
  const rowMap = new Map<string, Partial<WbAdStat>>();
  for (const campaign of stats) {
    if (!campaign.days) continue;
    const ctype = typeById.get(campaign.advertId);
    for (const day of campaign.days)
      for (const app of day.apps)
        for (const nm of app.nms) {
          const key = `${day.date}_${campaign.advertId}_${nm.nmId}`;
          const e = rowMap.get(key);
          if (e) {
            e.views = (e.views || 0) + (nm.views || 0);
            e.clicks = (e.clicks || 0) + (nm.clicks || 0);
            e.atbs = (e.atbs || 0) + (nm.atbs || 0);
            e.orders_count = (e.orders_count || 0) + (nm.orders || 0);
            e.orders_sum = (e.orders_sum || 0) + (nm.sum_price || 0);
            e.shks = (e.shks || 0) + (nm.shks || 0);
            e.ad_spend = (e.ad_spend || 0) + (nm.sum || 0);
            e.canceled = (e.canceled || 0) + (nm.canceled || 0);
            e.ctr = e.views! > 0 ? round((e.clicks! / e.views!) * 100) : 0;
            e.cpc = e.clicks! > 0 ? round(e.ad_spend! / e.clicks!) : 0;
            if (!e.product_name && nm.name) e.product_name = nm.name;
          } else {
            rowMap.set(key, {
              date: new Date(day.date), campaign_id: campaign.advertId, campaign_type: ctype ?? undefined,
              nm_id: nm.nmId, product_name: nm.name || undefined,
              views: nm.views || 0, clicks: nm.clicks || 0, ctr: nm.ctr || 0, cpc: nm.cpc || 0,
              atbs: nm.atbs || 0, orders_count: nm.orders || 0, orders_sum: nm.sum_price || 0,
              shks: nm.shks || 0, ad_spend: nm.sum || 0, canceled: nm.canceled || 0,
            });
          }
        }
  }
  const rows = Array.from(rowMap.values());
  for (let i = 0; i < rows.length; i += 500) {
    await statsRepo().createQueryBuilder().insert().into(WbAdStat).values(rows.slice(i, i + 500))
      .orUpdate(
        ['campaign_name', 'campaign_type', 'product_name', 'views', 'clicks', 'ctr', 'cpc', 'atbs',
          'orders_count', 'orders_sum', 'shks', 'ad_spend', 'canceled', 'updated_at'],
        ['date', 'campaign_id', 'nm_id'],
      ).execute();
  }
  return rows.length;
}

/** Маппер wb_ad_stats → mp_ad_daily по источникам (Поиск=au, Полки=apk). */
export async function syncAdsFromWbStats(days = 45): Promise<{ upserted: number }> {
  const rows = await AppDataSource.query(
    `SELECT date::text AS date, nm_id::text AS sku,
            CASE WHEN campaign_type IN (6, 9) THEN 'au' ELSE 'apk' END AS source,
            sum(views) AS impressions, sum(clicks) AS clicks, sum(ad_spend) AS spend,
            sum(atbs) AS carts, sum(orders_count) AS orders, sum(orders_sum) AS orders_sum
     FROM wb_ad_stats
     WHERE date > (now() - make_interval(days => $1::int))::date
     GROUP BY date, nm_id, source`,
    [days],
  );
  const input = rows.map((r: any) => ({
    date: r.date, sku: r.sku, source: r.source,
    impressions: Number(r.impressions), clicks: Number(r.clicks), spend: Number(r.spend),
    carts: Number(r.carts), orders: Number(r.orders), orders_sum: Number(r.orders_sum),
  }));
  const upserted = input.length ? await importAdRows('wb', input) : 0;
  return { upserted };
}

/** Полный автосинк рекламы: фетч (best-effort) + маппер. */
export async function autoSyncWbAds(days = 30): Promise<{ fetched: number; upserted: number; fetch_error?: string }> {
  const end = new Date().toISOString().slice(0, 10);
  const begin = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  let fetched = 0;
  let fetchError: string | undefined;
  try {
    fetched = await refreshWbAdStats(begin, end);
  } catch (e: any) {
    fetchError = String(e?.message || e);
    console.error('[wb-ad-sync] fetch fullstats failed (WB лимит?):', fetchError);
  }
  const { upserted } = await syncAdsFromWbStats(days + 15);
  console.log(`[wb-ad-sync] fetched ${fetched} в wb_ad_stats, смаплено ${upserted} в mp_ad_daily`);
  return { fetched, upserted, ...(fetchError ? { fetch_error: fetchError } : {}) };
}
