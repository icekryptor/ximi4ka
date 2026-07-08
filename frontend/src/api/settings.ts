import { apiClient } from './client'

export interface OzonStatus {
  perf_configured: boolean
  seller_configured: boolean
  perf_client_id_masked: string | null
  seller_client_id_masked: string | null
  updated_at: string | null
}

export interface IntegrationsStatus {
  wb: {
    configured: boolean
    masked: string | null
    updated_at: string | null
  }
  ozon?: OzonStatus
}

export interface OzonCredsPatch {
  perf_client_id?: string
  perf_client_secret?: string
  seller_client_id?: string
  seller_api_key?: string
}

export const settingsApi = {
  integrations: async (): Promise<IntegrationsStatus> => {
    const r = await apiClient.get<IntegrationsStatus>('/settings/integrations')
    return r.data
  },
  saveWbToken: async (token: string): Promise<{ success: boolean; configured: boolean; masked: string | null }> => {
    const r = await apiClient.put('/settings/wb-token', { token })
    return r.data
  },
  saveOzonCreds: async (patch: OzonCredsPatch): Promise<{ success: boolean; ozon: OzonStatus }> => {
    const r = await apiClient.put('/settings/ozon-creds', patch)
    return r.data
  },
}
