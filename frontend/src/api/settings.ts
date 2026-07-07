import { apiClient } from './client'

export interface IntegrationsStatus {
  wb: {
    configured: boolean
    masked: string | null
    updated_at: string | null
  }
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
}
