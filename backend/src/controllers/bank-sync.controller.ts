import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankSyncConfig, BankSyncProvider } from '../entities/BankSyncConfig'
import { BankSyncLog } from '../entities/BankSyncLog'
import { encryptJson } from '../lib/crypto-util'
import { bankSyncService } from '../services/bank-sync/bank-sync.service'

const configRepo = () => AppDataSource.getRepository(BankSyncConfig)
const logRepo = () => AppDataSource.getRepository(BankSyncLog)
const MASTER_KEY_ENV = 'BANK_SYNC_SECRET_KEY'

function publicShape(config: BankSyncConfig) {
  // Never expose credentials_encrypted via API
  return {
    id: config.id,
    bank_account_id: config.bank_account_id,
    provider: config.provider,
    enabled: config.enabled,
    last_sync_at: config.last_sync_at,
    last_period_end: config.last_period_end,
    has_credentials: !!config.credentials_encrypted,
    created_at: config.created_at,
    updated_at: config.updated_at,
  }
}

export const bankSyncController = {
  async list(_req: Request, res: Response) {
    try {
      const configs = await configRepo().find({ order: { created_at: 'ASC' } })
      res.json(configs.map(publicShape))
    } catch (e: any) {
      console.error('[bank-sync.list]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки конфигов синхронизации' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const masterKey = process.env[MASTER_KEY_ENV]
      if (!masterKey) {
        return res.status(500).json({ error: 'BANK_SYNC_SECRET_KEY не настроен на сервере' })
      }
      const { bank_account_id, provider, credentials, run_initial_sync = true } = req.body as {
        bank_account_id: string
        provider: BankSyncProvider
        credentials: Record<string, unknown>
        run_initial_sync?: boolean
      }
      if (!bank_account_id || !provider || !credentials) {
        return res.status(400).json({ error: 'bank_account_id, provider, credentials обязательны' })
      }

      const encrypted = encryptJson(credentials, masterKey)
      const config = configRepo().create({
        bank_account_id,
        provider,
        enabled: true,
        credentials_encrypted: encrypted,
      })
      const saved = await configRepo().save(config)

      // Trigger initial sync in background (don't block the response)
      if (run_initial_sync) {
        bankSyncService.runOne(saved.id).catch((e) => {
          console.error('[bank-sync.create] initial sync failed:', e?.message || e)
        })
      }

      res.status(201).json(publicShape(saved))
    } catch (e: any) {
      console.error('[bank-sync.create]', e?.message || e)
      res.status(500).json({ error: 'Ошибка создания конфига синхронизации' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const masterKey = process.env[MASTER_KEY_ENV]
      if (!masterKey) {
        return res.status(500).json({ error: 'BANK_SYNC_SECRET_KEY не настроен на сервере' })
      }
      const { id } = req.params
      const { enabled, credentials } = req.body as {
        enabled?: boolean
        credentials?: Record<string, unknown>
      }

      const patch: Partial<BankSyncConfig> = {}
      if (typeof enabled === 'boolean') patch.enabled = enabled
      if (credentials) patch.credentials_encrypted = encryptJson(credentials, masterKey)

      await configRepo().update(id, patch)
      const updated = await configRepo().findOne({ where: { id } })
      if (!updated) return res.status(404).json({ error: 'Конфиг не найден' })
      res.json(publicShape(updated))
    } catch (e: any) {
      console.error('[bank-sync.update]', e?.message || e)
      res.status(500).json({ error: 'Ошибка обновления конфига' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const r = await configRepo().delete(req.params.id)
      if (r.affected === 0) return res.status(404).json({ error: 'Конфиг не найден' })
      res.json({ ok: true })
    } catch (e: any) {
      console.error('[bank-sync.delete]', e?.message || e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },

  async run(req: Request, res: Response) {
    try {
      const log = await bankSyncService.runOne(req.params.id)
      res.json({ ok: true, log })
    } catch (e: any) {
      console.error('[bank-sync.run]', e?.message || e)
      res.status(500).json({ error: String(e?.message || 'Ошибка синхронизации') })
    }
  },

  async listLogs(req: Request, res: Response) {
    try {
      const { config_id, limit = '20' } = req.query as { config_id?: string; limit?: string }
      const qb = logRepo().createQueryBuilder('l').orderBy('l.started_at', 'DESC').limit(Number(limit) || 20)
      if (config_id) qb.where('l.bank_sync_config_id = :cid', { cid: config_id })
      const logs = await qb.getMany()
      res.json(logs)
    } catch (e: any) {
      console.error('[bank-sync.listLogs]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки лога' })
    }
  },
}
