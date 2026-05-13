import { apiClient } from './client'
import type { ContentMetricSnapshot } from './types'

export const metricSnapshotsApi = {
  listByPublication: async (publicationId: string): Promise<ContentMetricSnapshot[]> => {
    const r = await apiClient.get<ContentMetricSnapshot[]>('/content-metric-snapshots', {
      params: { publication_id: publicationId },
    })
    return r.data
  },
  latestForPublications: async (publicationIds: string[]): Promise<Record<string, ContentMetricSnapshot>> => {
    if (publicationIds.length === 0) return {}
    const r = await apiClient.get<ContentMetricSnapshot[]>('/content-metric-snapshots/latest', {
      params: { publication_ids: publicationIds.join(',') },
    })
    const map: Record<string, ContentMetricSnapshot> = {}
    for (const s of r.data) map[s.publication_id] = s
    return map
  },
  create: async (data: Partial<ContentMetricSnapshot>): Promise<ContentMetricSnapshot> => {
    const r = await apiClient.post<ContentMetricSnapshot>('/content-metric-snapshots', data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-metric-snapshots/${id}`)
  },
}
