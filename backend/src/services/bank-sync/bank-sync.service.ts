import { AppDataSource } from '../../config/database'
import { BankSyncConfig } from '../../entities/BankSyncConfig'
import { BankSyncLog } from '../../entities/BankSyncLog'
import { decryptJson } from '../../lib/crypto-util'
import { TochkaApiClient, TochkaCredentials, tochkaApiToNormalizedRow } from './tochka.api'
import { bankImportService } from '../bankImport.service'

const BACKFILL_DAYS = 30
const MASTER_KEY_ENV = 'BANK_SYNC_SECRET_KEY'

export const bankSyncService = {
  /** Run sync for all enabled configs. Called by cron. */
  async runAll(): Promise<void> {
    const configRepo = AppDataSource.getRepository(BankSyncConfig)
    const configs = await configRepo.find({ where: { enabled: true } })
    for (const config of configs) {
      try {
        await this.runOne(config.id)
      } catch (e: any) {
        console.error(`[bank-sync] config ${config.id} failed:`, e?.message || e)
      }
    }
  },

  /** Run sync for a single config. Returns the log entry. */
  async runOne(configId: string): Promise<BankSyncLog> {
    const masterKey = process.env[MASTER_KEY_ENV]
    if (!masterKey) {
      throw new Error(`${MASTER_KEY_ENV} env var is not set`)
    }

    const configRepo = AppDataSource.getRepository(BankSyncConfig)
    const logRepo = AppDataSource.getRepository(BankSyncLog)

    const config = await configRepo.findOne({ where: { id: configId } })
    if (!config) throw new Error(`Sync config ${configId} not found`)
    if (!config.credentials_encrypted) throw new Error('Credentials not set')

    // Determine sync period
    const today = new Date().toISOString().slice(0, 10)
    const from = config.last_period_end
      ? new Date(new Date(config.last_period_end).getTime() + 86400_000).toISOString().slice(0, 10)
      : new Date(Date.now() - BACKFILL_DAYS * 86400_000).toISOString().slice(0, 10)
    const to = today

    // Create log entry
    const log = logRepo.create({
      bank_sync_config_id: config.id,
      status: 'running',
      period_start: from,
      period_end: to,
    })
    const savedLog = await logRepo.save(log)

    try {
      let rowsFetched = 0
      let result: { rows_imported: number; rows_skipped_dup: number; rows_pending_review: number }

      if (config.provider === 'tochka') {
        const creds = decryptJson<TochkaCredentials>(config.credentials_encrypted, masterKey)
        const client = new TochkaApiClient(creds)
        const accounts = await client.listAccounts()
        // For MVP: take the first account. Multi-account support — future iteration.
        if (accounts.length === 0) throw new Error('Точка не вернула ни одного счёта')
        const account = accounts[0]
        const txs = await client.fetchStatement(account.accountId, from, to)
        rowsFetched = txs.length
        const rows = txs.map(tochkaApiToNormalizedRow)

        result = await bankImportService.commitNormalized({
          bank_account_id: config.bank_account_id,
          rows,
          file_name: `tochka-sync-${from}-to-${to}`,
          period_start: from,
          period_end: to,
          imported_by: null,
          flag_unmatched_for_review: true,
        })
      } else {
        throw new Error(`Provider ${config.provider} not implemented in Phase 1`)
      }

      // Mark log success + update config
      await logRepo.update(savedLog.id, {
        status: 'success',
        finished_at: new Date(),
        rows_fetched: rowsFetched,
        rows_imported: result.rows_imported,
        rows_skipped_dup: result.rows_skipped_dup,
        rows_pending_review: result.rows_pending_review,
      })
      await configRepo.update(config.id, {
        last_sync_at: new Date(),
        last_period_end: to,
      })

      const updated = await logRepo.findOne({ where: { id: savedLog.id } })
      return updated!
    } catch (e: any) {
      await logRepo.update(savedLog.id, {
        status: 'failed',
        finished_at: new Date(),
        error_message: String(e?.message || e).slice(0, 1000),
      })
      throw e
    }
  },
}
