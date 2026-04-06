import { apiClient as api } from './client'

export interface ContentUnit {
  id: string
  title: string
  description: string | null
  material_url: string | null
  youtube_date: string | null
  instagram_date: string | null
  tiktok_date: string | null
  youtube_published: boolean
  instagram_published: boolean
  tiktok_published: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type ContentUnitCreate = Omit<ContentUnit, 'id' | 'created_by' | 'created_at' | 'updated_at'>

export const contentUnitsApi = {
  getAll: async (): Promise<ContentUnit[]> => {
    const { data } = await api.get('/content-units')
    return data
  },

  getOne: async (id: string): Promise<ContentUnit> => {
    const { data } = await api.get(`/content-units/${id}`)
    return data
  },

  create: async (payload: Partial<ContentUnitCreate>): Promise<ContentUnit> => {
    const { data } = await api.post('/content-units', payload)
    return data
  },

  update: async (id: string, payload: Partial<ContentUnitCreate>): Promise<ContentUnit> => {
    const { data } = await api.put(`/content-units/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/content-units/${id}`)
  },
}
