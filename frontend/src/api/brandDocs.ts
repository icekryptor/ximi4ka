import { apiClient } from './client'
import { BrandDoc } from './types'

export const brandDocsApi = {
  list: async (): Promise<BrandDoc[]> => {
    const res = await apiClient.get<BrandDoc[]>('/brand-docs')
    return res.data
  },
  get: async (slug: string): Promise<BrandDoc | null> => {
    try {
      const res = await apiClient.get<BrandDoc>(`/brand-docs/${slug}`)
      return res.data
    } catch (e: any) {
      if (e?.response?.status === 404) return null
      throw e
    }
  },
  upsert: async (slug: string, payload: { title?: string; content: string; version?: string | null }): Promise<BrandDoc> => {
    const res = await apiClient.put<BrandDoc>(`/brand-docs/${slug}`, payload)
    return res.data
  },
}
