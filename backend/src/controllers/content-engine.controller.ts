import { Request, Response } from 'express'
import { In } from 'typeorm'
import { recipeEngine } from '../services/recipe-engine'
import { previewRecipeStepPrompt } from './claude.controller'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { getPlannerContext } from '../services/content-context.service'

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

      // Planner — top-level upstream-агент: статический промпт из воронки +
      // активных ICP-сегментов + выжимки стратегии. Ноль вызовов Claude.
      // Бриф собирает общий content-context.service (DRY с MCP-сервером).
      const plannerCtx = await getPlannerContext()
      const plannerPrompt = plannerCtx.brief

      // Доки Planner-узла нужны в панели фронта → добавим их слаги в загрузку docs.
      neededSlugs.add('funnel_levels')
      neededSlugs.add('content_plan_current')
      neededSlugs.add('strategy_current')

      const planner = {
        reads: [
          { slug: 'funnel_levels', title: 'Воронка контента (TOFU/MOFU/BOFU)' },
          { slug: 'strategy_current', title: 'Стратегия (цели)' },
          { slug: 'icp_segments', title: 'ICP-сегменты (динамически)' },
        ],
        produces: { slug: 'content_plan_current', title: 'Контент-план' },
        promptPreview: plannerPrompt,
      }

      // виртуальные маркеры — динамические источники, не brand_doc
      const VIRTUAL_MARKERS: Record<string, { title: string; content: string }> = {
        'unit.target_segment': {
          title: 'ICP-сегмент юнита (динамически)',
          content:
            'Подставляется из target_segment контент-юнита на прогоне: имя сегмента, роль, возраст, описание/боли. У каждого юнита свой сегмент — задаётся в контент-банке.',
        },
        style_learned: {
          title: 'Накопленные правила стиля (динамически)',
          content:
            'Правила стиля, накопленные из правок копирайтера через MCP (learn_from_edit → save_style_patterns). Подтягиваются в бриф Writer на прогоне по формату. Свод и сигнал сходимости — в секции «Обучение стиля».',
        },
      }
      const docs: Record<string, { title: string; content: string }> = {}
      for (const [marker, doc] of Object.entries(VIRTUAL_MARKERS)) {
        if (neededSlugs.has(marker)) docs[marker] = doc
      }
      // brand_docs для панели (маркеры не ищем в БД)
      const dbSlugs = [...neededSlugs].filter((sl) => !(sl in VIRTUAL_MARKERS))
      if (dbSlugs.length > 0) {
        const rows = await AppDataSource.getRepository(BrandDoc).find({
          where: { slug: In(dbSlugs) },
        })
        for (const d of rows) docs[d.slug] = { title: d.title ?? d.slug, content: d.content ?? '' }
      }
      // слаги без записи в БД — пустышка, чтобы фронт показал «документ пуст»
      for (const sl of neededSlugs) if (!docs[sl]) docs[sl] = { title: sl, content: '' }

      res.json({ planner, contentTypes, docs })
    } catch (e: any) {
      console.error('[content-engine.blueprint]', e?.message || e)
      res.status(500).json({ error: 'Ошибка построения схемы движка' })
    }
  },
}
