import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentRubric } from '../entities/ContentRubric'
import { getPromptCache } from '../services/prompt-cache'

export const voiceoverController = {
  async bootstrap(req: Request, res: Response) {
    try {
      const cache = await getPromptCache()

      const rubricRepo = AppDataSource.getRepository(ContentRubric)
      const rubrics = await rubricRepo.find({
        order: { sort_order: 'ASC' },
      })

      res.json({
        rubrics,
        brandDocs: cache.brandDocs,
        etalonScript: cache.etalonScript,
      })
    } catch (e: any) {
      console.error('Voiceover bootstrap error:', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки данных студии' })
    }
  },
}
