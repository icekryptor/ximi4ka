import { Request, Response } from 'express'

const EDGE_URL = 'https://jubkezbvccwvujregkfq.supabase.co/functions/v1/content-engine-stats'

interface CacheEntry {
  data: any
  fetchedAt: number
}
const CACHE_TTL_MS = 10 * 1000  // 10s — protects Edge Function from N×30s polling
let cache: CacheEntry | null = null

export const contentEngineController = {
  async stats(_req: Request, res: Response) {
    try {
      if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return res.json(cache.data)
      }
      const token = process.env.DASHBOARD_TOKEN ?? ''
      if (!token) {
        console.error('content-engine: DASHBOARD_TOKEN env var missing')
        return res.status(500).json({ error: 'Сервер не настроен (DASHBOARD_TOKEN)' })
      }
      const r = await fetch(`${EDGE_URL}?token=${encodeURIComponent(token)}`)
      if (!r.ok) {
        const text = await r.text()
        console.error('Edge function error:', r.status, text.slice(0, 200))
        return res.status(502).json({ error: 'Не удалось загрузить данные дашборда' })
      }
      const data = await r.json()
      cache = { data, fetchedAt: Date.now() }
      res.json(data)
    } catch (e: any) {
      console.error('content-engine stats error:', e?.message || e)
      res.status(500).json({ error: 'Ошибка дашборда' })
    }
  },
}
