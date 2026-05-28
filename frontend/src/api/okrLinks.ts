import { apiClient } from './client'

export type OkrLinkCounts = Record<string, { projects: number; tasks: number }>

export const okrLinksApi = {
  async counts(): Promise<OkrLinkCounts> {
    const r = await apiClient.get<OkrLinkCounts>('/okr-links/counts')
    return r.data
  },
}
