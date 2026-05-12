import { apiClient } from './client'
import type { AnalyticsFilters, AnalyticsResponse } from './types'

export const marketingAnalyticsApi = {
  fetch: async (filters: AnalyticsFilters): Promise<AnalyticsResponse> => {
    const r = await apiClient.get<AnalyticsResponse>('/marketing/analytics', { params: filters })
    return r.data
  },
}
