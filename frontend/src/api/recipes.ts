import { apiClient } from './client'
import type { Recipe, RecipeState } from './types'
import type { ContentUnit } from './contentBank'

export const recipesApi = {
  list: async (): Promise<Recipe[]> => {
    const res = await apiClient.get<Recipe[]>('/recipes')
    return res.data
  },
  getByType: async (contentType: string): Promise<Recipe | null> => {
    try {
      const res = await apiClient.get<Recipe>(`/recipes/${contentType}`)
      return res.data
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number } }
      if (ax?.response?.status === 404) return null
      throw e
    }
  },
  initForUnit: async (unitId: string): Promise<ContentUnit> => {
    const res = await apiClient.post<ContentUnit>(`/content-units/${unitId}/recipe-init`)
    return res.data
  },
  patchState: async (unitId: string, state: RecipeState): Promise<ContentUnit> => {
    const res = await apiClient.patch<ContentUnit>(`/content-units/${unitId}/recipe-state`, state)
    return res.data
  },
  runStep: async (unitId: string, stepId: string, customPrompt?: string): Promise<{ text: string; model: string }> => {
    const res = await apiClient.post<{ text: string; model: string }>('/claude/recipe-step', {
      unit_id: unitId,
      step_id: stepId,
      custom_prompt: customPrompt,
    })
    return res.data
  },
}
