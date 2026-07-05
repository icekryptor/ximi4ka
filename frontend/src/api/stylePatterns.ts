import { apiClient } from './client'

// ─── Правила стиля (самообучение Writer'а) ───────────────────────────────────
// Read-only свод накопленных правил стиля по формату. Пишет правила только
// агент через MCP (learn_from_edit → save_style_patterns); фронт лишь читает.
// Типы синхронны с backend entity StylePattern.

export interface StylePattern {
  id: string
  format: string // content_type (short_post, ...)
  code: string // А11 | С10 | Э8 ...
  title: string
  before: string | null // «как НЕ надо»
  after: string | null // «как надо»
  rationale: string
  source_note: string | null // контекст правки (откуда правило)
  created_at: string
}

export interface StylePatternsResponse {
  format: string
  patterns: StylePattern[]
}

export const stylePatternsApi = {
  list: async (format: string): Promise<StylePatternsResponse> => {
    const r = await apiClient.get<StylePatternsResponse>('/style-patterns', {
      params: { format },
    })
    return r.data
  },
}
