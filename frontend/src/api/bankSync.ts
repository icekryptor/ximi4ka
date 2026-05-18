import { apiClient } from './client'

export type BankSyncProvider = 'tochka' | 'ozon_email'

export interface BankSyncConfig {
  id: string
  bank_account_id: string
  provider: BankSyncProvider
  enabled: boolean
  last_sync_at: string | null
  last_period_end: string | null
  has_credentials: boolean
  created_at: string
  updated_at: string
}

export interface BankSyncLog {
  id: string
  bank_sync_config_id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  period_start: string | null
  period_end: string | null
  rows_fetched: number
  rows_imported: number
  rows_skipped_dup: number
  rows_pending_review: number
  error_message: string | null
}

export const bankSyncApi = {
  listConfigs: async (): Promise<BankSyncConfig[]> => {
    const r = await apiClient.get<BankSyncConfig[]>('/bank-sync/configs')
    return r.data
  },
  createConfig: async (payload: {
    bank_account_id: string
    provider: BankSyncProvider
    credentials: Record<string, unknown>
    run_initial_sync?: boolean
  }): Promise<BankSyncConfig> => {
    const r = await apiClient.post<BankSyncConfig>('/bank-sync/configs', payload)
    return r.data
  },
  updateConfig: async (
    id: string,
    payload: { enabled?: boolean; credentials?: Record<string, unknown> },
  ): Promise<BankSyncConfig> => {
    const r = await apiClient.put<BankSyncConfig>(`/bank-sync/configs/${id}`, payload)
    return r.data
  },
  deleteConfig: async (id: string): Promise<void> => {
    await apiClient.delete(`/bank-sync/configs/${id}`)
  },
  run: async (id: string): Promise<{ ok: true; log: BankSyncLog }> => {
    const r = await apiClient.post<{ ok: true; log: BankSyncLog }>(`/bank-sync/configs/${id}/run`)
    return r.data
  },
  logs: async (configId?: string): Promise<BankSyncLog[]> => {
    const params = configId ? { config_id: configId } : undefined
    const r = await apiClient.get<BankSyncLog[]>('/bank-sync/logs', { params })
    return r.data
  },
}
