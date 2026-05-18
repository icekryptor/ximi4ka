import cron from 'node-cron'
import { bankSyncService } from './bank-sync.service'

const CRON_SCHEDULE = '0 4 * * *' // 04:00 UTC = 07:00 MSK

let started = false

export function startBankSyncScheduler(): void {
  if (started) return
  if (process.env.BANK_SYNC_ENABLED === 'false') {
    console.log('[bank-sync] scheduler disabled via BANK_SYNC_ENABLED=false')
    return
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[bank-sync] cron tick starting')
    try {
      await bankSyncService.runAll()
      console.log('[bank-sync] cron tick complete')
    } catch (e: any) {
      console.error('[bank-sync] cron tick failed:', e?.message || e)
    }
  })
  started = true
  console.log(`[bank-sync] scheduler started (cron: ${CRON_SCHEDULE})`)
}
