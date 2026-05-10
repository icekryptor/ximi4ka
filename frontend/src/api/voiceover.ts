import { apiClient } from './client'
import { ContentRubric } from './contentBank'

export interface FactcheckItem {
  type: 'ok' | 'warn' | 'err' | 'info'
  text: string
}

export interface Pattern {
  code: string
  title: string
  before?: string
  after?: string
  rationale: string
}

export interface BootstrapResponse {
  rubrics: ContentRubric[]
  brandDocs: {
    style_guide_video: string
    rubrics_matrix: string
  }
  etalonScript: string | null
}

export const voiceoverApi = {
  bootstrap: async (): Promise<BootstrapResponse> => {
    const r = await apiClient.get<BootstrapResponse>('/voiceover/bootstrap')
    return r.data
  },

  generate: async (params: {
    topic: string
    brand?: string
    duration?: string
    styles?: string[]
  }): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/generate', params)
    return r.data
  },

  factcheck: async (script: string): Promise<{ items: FactcheckItem[] }> => {
    const r = await apiClient.post<{ items: FactcheckItem[] }>('/claude/factcheck', { script })
    return r.data
  },

  style: async (script: string, brand?: string): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/style', { script, brand })
    return r.data
  },

  edit: async (script: string, notes: string): Promise<{ text: string }> => {
    const r = await apiClient.post<{ text: string }>('/claude/edit', { script, notes })
    return r.data
  },

  preprocess: async (script: string): Promise<{ chunks: string[] }> => {
    const r = await apiClient.post<{ chunks: string[] }>('/claude/preprocess', { script })
    return r.data
  },

  editWithLearning: async (params: {
    originalScript: string
    notes?: string
    editedScript?: string
  }): Promise<{ finalScript: string; summary: string; patterns: Pattern[] }> => {
    const r = await apiClient.post<{
      finalScript: string
      summary: string
      patterns: Pattern[]
    }>('/claude/edit-with-learning', params)
    return r.data
  },

  extendGuide: async (
    addenda: Pattern[],
  ): Promise<{ version: string; addendaCount: number }> => {
    const r = await apiClient.post<{ version: string; addendaCount: number }>(
      '/voiceover/extend-guide',
      { addenda },
    )
    return r.data
  },

  refreshCache: async (): Promise<{ ok: true }> => {
    const r = await apiClient.post<{ ok: true }>('/voiceover/cache/refresh')
    return r.data
  },
}
