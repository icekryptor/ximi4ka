import cron from 'node-cron';
import { syncWbFunnel } from './mp-analytics.service';
import { autoSyncWbAds } from './wb-ad-sync.service';
import { syncWbStocks } from './wb-stock-sync.service';

// WB воронка/продажи — раз в день (06:00 UTC ≈ 09:00 МСК), одно окно за прогон.
const CRON_SCHEDULE = '0 6 * * *';

let started = false;

export function startMpAnalyticsScheduler(): void {
  if (started) return;
  if (process.env.MP_ANALYTICS_ENABLED === 'false') {
    console.log('[mp-analytics] scheduler disabled via MP_ANALYTICS_ENABLED=false');
    return;
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const { items, upserted } = await syncWbFunnel(30);
      console.log(`[mp-analytics] cron tick: items ${items}, upserted ${upserted}`);
    } catch (e: any) {
      console.error('[mp-analytics] cron tick failed:', e?.message || e);
    }
    try {
      const { fetched, upserted } = await autoSyncWbAds(30);
      console.log(`[mp-analytics] ad-sync tick: fetched ${fetched}, upserted ${upserted}`);
    } catch (e: any) {
      console.error('[mp-analytics] ad-sync tick failed:', e?.message || e);
    }
    try {
      await syncWbStocks(); // seller-analytics 3 req/min — самый мягкий лимит
    } catch (e: any) {
      console.error('[mp-analytics] stock-sync tick failed:', e?.message || e);
    }
  });
  started = true;
  console.log(`[mp-analytics] scheduler started (cron: ${CRON_SCHEDULE})`);
}
