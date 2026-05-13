import axios from 'axios'

export const STRATEGY_SLUG = 'strategy_current'
export const STRATEGY_TITLE = 'Маркетинг-стратегия'

export const rubFormatter = new Intl.NumberFormat('ru-RU')

export const truncate = (s: string | null | undefined, n = 80) => {
  if (!s) return ''
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}

export const errorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error
  }
  return fallback
}
