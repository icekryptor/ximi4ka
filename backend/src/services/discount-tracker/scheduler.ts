import cron from 'node-cron';
import { syncWbOrders } from '../spp-orders/spp-orders.service';

// Фактическая СПП по заказам (WB) — раз в день (05:00 UTC ≈ 08:00 МСК).
// Один запрос /orders за прогон отдаёт все заказы за окно → раскладываем по дням.
// Лимит WB 1 req/min при суточном сборе неактуален.
const CRON_SCHEDULE = '0 5 * * *';

let started = false;

export function startDiscountTrackerScheduler(): void {
  if (started) return;
  if (process.env.DISCOUNT_TRACKER_ENABLED === 'false') {
    console.log('[spp-orders] scheduler disabled via DISCOUNT_TRACKER_ENABLED=false');
    return;
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const { fetched, upserted } = await syncWbOrders(14);
      console.log(`[spp-orders] cron tick complete: fetched ${fetched}, upserted ${upserted}`);
    } catch (e: any) {
      console.error('[spp-orders] cron tick failed:', e?.message || e);
    }
  });
  started = true;
  console.log(`[spp-orders] scheduler started (cron: ${CRON_SCHEDULE})`);
}
