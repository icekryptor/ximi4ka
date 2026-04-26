import { apiClient as api } from './client'

export interface ImportRule {
  id: string
  match_type: string
  match_value: string
  counterparty_id: string | null
  category_id: string | null
  is_inter_transfer: boolean
  hit_count: number
  last_used_at: string | null
  counterparty?: { id: string; name: string }
  category?: { id: string; name: string }
}

export const importRulesApi = {
  list:   (): Promise<ImportRule[]> => api.get('/import-rules').then(r => r.data),
  remove: (id: string): Promise<void> => api.delete(`/import-rules/${id}`).then(() => {}),
}
