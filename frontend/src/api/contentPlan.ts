import { apiClient } from './client'

// ─── Контент-план ────────────────────────────────────────────────────────────
// Гибрид: brand_doc content_plan_current (markdown, источник истины для Writer)
// + лёгкая таблица-индекс content_plan_item. Типы синхронны с backend
// entity ContentPlanItem.

export type FunnelLevel = 'TOFU' | 'MOFU' | 'BOFU'
export type ContentPlanStatus = 'planned' | 'in_progress' | 'published'

export interface ContentPlanItem {
  id: string
  plan_date: string | null // YYYY-MM-DD
  funnel_level: FunnelLevel | string | null
  segment_id: string | null
  theme_id: string | null
  format: string | null
  goal: string | null
  status: ContentPlanStatus | string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentPlanDoc {
  title: string
  content: string
}

export interface ContentPlanData {
  doc: ContentPlanDoc | null
  items: ContentPlanItem[]
}

export type ContentPlanItemInput = Partial<
  Pick<
    ContentPlanItem,
    'plan_date' | 'funnel_level' | 'segment_id' | 'theme_id' | 'format' | 'goal' | 'status' | 'sort_order'
  >
>

export const contentPlanApi = {
  get: async (): Promise<ContentPlanData> => {
    const r = await apiClient.get<ContentPlanData>('/content-plan')
    return r.data
  },

  createItem: async (payload: ContentPlanItemInput): Promise<ContentPlanItem> => {
    const r = await apiClient.post<ContentPlanItem>('/content-plan/items', payload)
    return r.data
  },

  updateItem: async (id: string, payload: ContentPlanItemInput): Promise<ContentPlanItem> => {
    const r = await apiClient.put<ContentPlanItem>(`/content-plan/items/${id}`, payload)
    return r.data
  },

  deleteItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-plan/items/${id}`)
  },
}
