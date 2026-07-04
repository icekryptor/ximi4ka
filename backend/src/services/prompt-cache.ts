import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'

export const ETALON_UNIT_ID = 'f25b0c52-c5e7-4c5b-9fcf-881fa8e7838a'
export const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface PromptCache {
  brandDocs: {
    style_guide_video: string
    style_guide_text: string
    rubrics_matrix: string
    strategy_summary: string
    content_plan_current: string
    funnel_levels: string
  }
  etalonScript: string | null
  fetchedAt: number
}

let cache: PromptCache | null = null

/** Извлекает готовую авторскую выжимку из brand_doc `strategy_current`.
 *  Ищет секцию `## …TL;DR…` (по заголовку) до следующего `\n## ` (не `###`).
 *  Fallback: первые 2500 символов. Пусто → ''. */
export function extractStrategySummary(content: string): string {
  if (!content || !content.trim()) return ''
  const lines = content.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s+/.test(line) && !/^###/.test(line) && /TL;DR/i.test(line)) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return content.slice(0, 2500)
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) && !/^###/.test(lines[i])) {
      endIdx = i
      break
    }
  }
  return lines.slice(startIdx, endIdx).join('\n').trim()
}

async function loadFromDB(): Promise<PromptCache> {
  const docRepo = AppDataSource.getRepository(BrandDoc)
  const unitRepo = AppDataSource.getRepository(ContentUnit)

  const docs = await docRepo.find({
    where: {
      slug: In([
        'style_guide_video',
        'style_guide_text',
        'rubrics_matrix',
        'strategy_current',
        'content_plan_current',
        'funnel_levels',
      ]),
    },
  })
  const docMap: Record<string, string> = {}
  for (const d of docs) docMap[d.slug] = d.content

  const etalon = await unitRepo.findOne({
    where: { id: ETALON_UNIT_ID },
    select: ['id', 'script_text'],
  })

  return {
    brandDocs: {
      style_guide_video: docMap.style_guide_video ?? '',
      style_guide_text: docMap.style_guide_text ?? '',
      rubrics_matrix: docMap.rubrics_matrix ?? '',
      strategy_summary: extractStrategySummary(docMap.strategy_current ?? ''),
      content_plan_current: docMap.content_plan_current ?? '',
      funnel_levels: docMap.funnel_levels ?? '',
    },
    etalonScript: etalon?.script_text || null,
    fetchedAt: Date.now(),
  }
}

export async function getPromptCache(): Promise<PromptCache> {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = await loadFromDB()
  }
  return cache
}

export function invalidatePromptCache(): void {
  cache = null
}
