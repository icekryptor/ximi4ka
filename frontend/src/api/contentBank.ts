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

export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'

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
  review_grade: ReviewGrade | null
  review_feedback: string | null
  reviewed_at: string | null
  script_text: string | null
  video_brief: string | null
  voiceover_text: string | null
  ready_at: string | null
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
  review_grade?: string   // CSV: 'excellent,needs_work' or special 'null'
  search?: string
  sort?: 'created_at' | 'title' | 'status' | 'scheduled_at' | 'ready_at'
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

export interface ImportPreviewResponse {
  rubrics: { to_create: number; to_skip: number; parsed_total: number }
  units: { to_insert: number; to_update: number; to_skip_duplicate: number; parsed_total: number }
  errors: string[]
  warnings: string[]
  preview_token: string
}

export interface ImportCommitResponse {
  rubrics: { created: number; skipped: number }
  units: { inserted: number; updated: number; skipped: number }
  errors: string[]
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
  ungradedCount: async (): Promise<{ count: number }> => {
    const r = await apiClient.get<{ count: number }>('/content-units/ungraded-count')
    return r.data
  },
  export: async (params: UnitsListParams = {}): Promise<Blob> => {
    const r = await apiClient.get('/content-units/export', { params, responseType: 'blob' })
    return r.data as Blob
  },
  importPreview: async (file: File): Promise<ImportPreviewResponse> => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await apiClient.post<ImportPreviewResponse>(
      '/content-units/import/preview', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return r.data
  },
  importCommit: async (token: string): Promise<ImportCommitResponse> => {
    const r = await apiClient.post<ImportCommitResponse>(
      '/content-units/import/commit', { preview_token: token },
    )
    return r.data
  },

  rejectedCount: async (): Promise<{ count: number }> => {
    const r = await apiClient.get<{ count: number }>('/content-units/rejected-count')
    return r.data
  },

  purgeRejected: async (): Promise<{ deleted: number }> => {
    const r = await apiClient.delete<{ deleted: number }>('/content-units/purge-rejected')
    return r.data
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

export const REVIEW_GRADE_LABELS: Record<ReviewGrade, string> = {
  excellent: '✅ отлично',
  needs_work: '⚠️ доработать',
  rejected: '❌ отказ',
}
