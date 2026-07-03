import cron from 'node-cron';
import { runOnce } from './discount-tracker.service';

const CRON_SCHEDULE = '0 * * * *'; // каждый час, в :00

let started = false;

export function startDiscountTrackerScheduler(): void {
  if (started) return;
  if (process.env.DISCOUNT_TRACKER_ENABLED === 'false') {
    console.log('[discount-tracker] scheduler disabled via DISCOUNT_TRACKER_ENABLED=false');
    return;
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[discount-tracker] cron tick starting');
    try {
      const { snapshots, alerts } = await runOnce();
      console.log(`[discount-tracker] cron tick complete: ${snapshots} snapshots, ${alerts} alerts`);
    } catch (e: any) {
      console.error('[discount-tracker] cron tick failed:', e?.message || e);
    }
  });
  started = true;
  console.log(`[discount-tracker] scheduler started (cron: ${CRON_SCHEDULE})`);
}
