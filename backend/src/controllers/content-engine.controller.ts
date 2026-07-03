import { Request, Response } from 'express'
import { In } from 'typeorm'
import { recipeEngine } from '../services/recipe-engine'
import { previewRecipeStepPrompt } from './claude.controller'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'

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

  async blueprint(_req: Request, res: Response) {
    try {
      const recipes = recipeEngine.list()
      const neededSlugs = new Set<string>()
      const contentTypes = []

      for (const r of recipes) {
        const steps = []
        for (const s of r.steps) {
          const isAi = s.default_executor === 'ai_agent' && !!s.ai_assist_key
          let reads: string[] = []
          let promptPreview: string | null = null
          let hasBuilder = false
          if (isAi) {
            const preview = await previewRecipeStepPrompt(r.content_type, s.id)
            if (preview) {
              hasBuilder = true
              reads = preview.reads
              promptPreview = preview.promptPreview
              reads.forEach((sl) => neededSlugs.add(sl))
            }
          }
          steps.push({
            id: s.id,
            displayName: s.display_name,
            description: s.description ?? '',
            artifactKind: s.artifact_kind,
            executor: s.default_executor,
            aiAssistKey: s.ai_assist_key ?? null,
            reads, // слаги; фронт резолвит title из docs
            promptPreview,
            hasBuilder,
          })
        }
        contentTypes.push({
          type: r.content_type,
          displayName: r.display_name,
          description: r.description ?? '',
          steps,
        })
      }

      // brand_docs для панели
      const docs: Record<string, { title: string; content: string }> = {}
      if (neededSlugs.size > 0) {
        const rows = await AppDataSource.getRepository(BrandDoc).find({
          where: { slug: In([...neededSlugs]) },
        })
        for (const d of rows) docs[d.slug] = { title: d.title ?? d.slug, content: d.content ?? '' }
      }
      // слаги без записи в БД — пустышка, чтобы фронт показал «документ пуст»
      for (const sl of neededSlugs) if (!docs[sl]) docs[sl] = { title: sl, content: '' }

      res.json({ contentTypes, docs })
    } catch (e: any) {
      console.error('[content-engine.blueprint]', e?.message || e)
      res.status(500).json({ error: 'Ошибка построения схемы движка' })
    }
  },
}
