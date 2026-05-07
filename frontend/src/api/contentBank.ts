import { apiClient } from './client'

export type ContentType = 'short_video' | 'text_post' | 'other'

export type ContentStatus =
  | 'idea'
  | 'script'
  | 'filming'
  | 'editing'
  | 'ready'
  | 'published'
  | 'rejected'

export interface ContentRubric {
  id: string
  slug: string
  title: string
  emoji: string | null
  tone: string | null
  audience: string | null
  cta_template: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentPublication {
  id: string
  content_unit_id: string
  network: string
  scheduled_at: string | null
  published_at: string | null
  published_url: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentUnit {
  id: string
  rubric_id: string | null
  rubric: ContentRubric | null
  content_type: ContentType
  status: ContentStatus
  complexity: number | null
  title: string
  hook: string | null
  hook_ab: string | null
  visual: string | null
  essence: string | null
  notes: string | null
  video_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  publications: ContentPublication[]
}

export interface UnitsListParams {
  status?: string         // CSV
  rubric_id?: string      // CSV
  content_type?: string   // CSV
  network?: string        // CSV
  search?: string
  sort?: 'created_at' | 'title' | 'status'
  page?: number
  limit?: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface UnitsListResponse {
  data: ContentUnit[]
  pagination: PaginationMeta
}

// === Rubrics ===
export const rubricsApi = {
  getAll: async (): Promise<ContentRubric[]> => {
    const r = await apiClient.get<ContentRubric[]>('/content-rubrics')
    return r.data
  },
  create: async (data: Partial<ContentRubric>): Promise<ContentRubric> => {
    const r = await apiClient.post<ContentRubric>('/content-rubrics', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentRubric>): Promise<ContentRubric> => {
    const r = await apiClient.put<ContentRubric>(`/content-rubrics/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-rubrics/${id}`)
  },
}

// === Units ===
export const unitsApi = {
  list: async (params: UnitsListParams = {}): Promise<UnitsListResponse> => {
    const r = await apiClient.get<UnitsListResponse>('/content-units', { params })
    return r.data
  },
  getOne: async (id: string): Promise<ContentUnit> => {
    const r = await apiClient.get<ContentUnit>(`/content-units/${id}`)
    return r.data
  },
  create: async (data: Partial<ContentUnit>): Promise<ContentUnit> => {
    const r = await apiClient.post<ContentUnit>('/content-units', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentUnit>): Promise<ContentUnit> => {
    const r = await apiClient.put<ContentUnit>(`/content-units/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-units/${id}`)
  },
}

// === Publications ===
export const publicationsApi = {
  create: async (data: Partial<ContentPublication>): Promise<ContentPublication> => {
    const r = await apiClient.post<ContentPublication>('/content-publications', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentPublication>): Promise<ContentPublication> => {
    const r = await apiClient.put<ContentPublication>(`/content-publications/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-publications/${id}`)
  },
}

// === Status / Type metadata for UI ===

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: '💡 идея',
  script: '📝 сценарий',
  filming: '🎬 снимаем',
  editing: '✂️ монтируем',
  ready: '✅ готово',
  published: '🚀 опубликовано',
  rejected: '❌ отказ',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  short_video: '🎬 Ролик',
  text_post: '📝 Текст',
  other: 'Прочее',
}

export const COMPLEXITY_LABELS: Record<number, string> = {
  1: '⭐ просто',
  2: '⭐⭐ средне',
  3: '⭐⭐⭐ сложно',
}
