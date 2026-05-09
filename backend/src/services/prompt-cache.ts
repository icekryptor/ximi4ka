import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'

export const ETALON_UNIT_ID = 'f25b0c52-c5e7-4c5b-9fcf-881fa8e7838a'
export const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface PromptCache {
  brandDocs: { style_guide_video: string; rubrics_matrix: string }
  etalonScript: string | null
  fetchedAt: number
}

let cache: PromptCache | null = null

async function loadFromDB(): Promise<PromptCache> {
  const docRepo = AppDataSource.getRepository(BrandDoc)
  const unitRepo = AppDataSource.getRepository(ContentUnit)

  const docs = await docRepo.find({
    where: { slug: In(['style_guide_video', 'rubrics_matrix']) },
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
      rubrics_matrix: docMap.rubrics_matrix ?? '',
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
