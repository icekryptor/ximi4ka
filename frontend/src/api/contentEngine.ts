import { apiClient } from './client'

export type StageKey =
  | 'ideas'
  | 'triage_needs_work'
  | 'excellent'
  | 'planning'
  | 'scripting'
  | 'voiceover_prep'
  | 'production'
  | 'published'
  | 'rejected'

export interface DashboardUnit {
  id: string
  title: string
  hook: string | null
  complexity: number | null
  rubric: string | null
  rubric_emoji: string | null
  status: string
  review_grade: string | null
  has_script: boolean
  has_voiceover: boolean
  has_video: boolean
  publications: Array<{
    id: string
    network: string
    scheduled_at: string | null
    published_at: string | null
    published_url: string | null
  }>
  published_count: number
  scheduled_count: number
  updated_at: string
  ready_at: string | null
}

export interface QueueItem {
  id: string
  unit_id: string
  unit_title: string
  network: 'tiktok' | 'youtube' | 'instagram'
  scheduled_at: string
  has_video: boolean
}

export interface RecentItem {
  id: string
  unit_title: string
  network: string
  published_at: string
  published_url: string | null
}

export interface DashboardRubric {
  id: string
  slug: string
  title: string
  emoji: string | null
}

export interface DashboardStats {
  counts: Record<StageKey, number>
  total_units: number
  total_publications: number
  published_total: number
  scheduled_total: number
}

export interface DashboardData {
  ok: true
  generated_at: string
  stats: DashboardStats
  buckets: Record<StageKey, DashboardUnit[]>
  today_queue: QueueItem[]
  recent_published: RecentItem[]
  rubrics: DashboardRubric[]
}

// ─── Blueprint (схема движка) ────────────────────────────────────────────────

export type StepExecutor = 'ai_agent' | 'self'

export interface BlueprintStep {
  id: string
  displayName: string
  description: string
  artifactKind: string
  executor: StepExecutor
  aiAssistKey: string | null
  reads: string[] // слаги brand_docs; title резолвится из BlueprintData.docs
  promptPreview: string | null
  hasBuilder: boolean // false → у AI-шага есть ai_assist_key, но билдер не реализован
}

export interface BlueprintContentType {
  type: string
  displayName: string
  description: string
  steps: BlueprintStep[]
}

export interface BlueprintDoc {
  title: string
  content: string
}

export interface BlueprintRef {
  slug: string
  title: string
}

export interface BlueprintPlanner {
  reads: BlueprintRef[]
  produces: BlueprintRef
  promptPreview: string
}

export interface BlueprintData {
  planner: BlueprintPlanner | null
  contentTypes: BlueprintContentType[]
  docs: Record<string, BlueprintDoc>
}

export const contentEngineApi = {
  stats: async (): Promise<DashboardData> => {
    const r = await apiClient.get<DashboardData>('/content-engine/stats')
    return r.data
  },

  blueprint: async (): Promise<BlueprintData> => {
    const r = await apiClient.get<BlueprintData>('/content-engine/blueprint')
    return r.data
  },
}
