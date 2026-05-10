import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentRubric } from '../entities/ContentRubric'
import { getPromptCache, invalidatePromptCache } from '../services/prompt-cache'

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

  async extendGuide(req: Request, res: Response) {
    try {
      const { addenda } = req.body as {
        addenda?: Array<{
          code: string
          title: string
          before?: string
          after?: string
          rationale: string
        }>
      }
      if (!addenda || !Array.isArray(addenda) || addenda.length === 0) {
        return res.status(400).json({ error: 'Поле addenda обязательно (непустой массив)' })
      }

      const docRepo = AppDataSource.getRepository(BrandDoc)
      const doc = await docRepo.findOne({ where: { slug: 'style_guide_video' } })
      if (!doc) return res.status(404).json({ error: 'style_guide_video не найден' })

      // Build markdown block matching v1.4 convention
      const lines: string[] = ['', '---', '']
      const dateStr = new Date().toISOString().slice(0, 10)
      lines.push(`## ✏️ Дополнения от оператора (${dateStr})`)
      lines.push('')
      for (const a of addenda) {
        lines.push(`### ${a.code}. ${a.title}`)
        if (a.before) lines.push(`❌ «${a.before}»`)
        if (a.after) lines.push(`✅ «${a.after}»`)
        lines.push(a.rationale)
        lines.push('')
      }
      const newContent = doc.content + lines.join('\n')

      // Bump version: 1.4 → 1.5; if non-numeric, append timestamp
      const currentVersion = doc.version ?? '1.0'
      const m = currentVersion.match(/^(\d+)\.(\d+)$/)
      const newVersion = m
        ? `${m[1]}.${parseInt(m[2], 10) + 1}`
        : `${currentVersion}+${Date.now()}`

      doc.content = newContent
      doc.version = newVersion
      await docRepo.save(doc)
      invalidatePromptCache()

      res.json({ version: newVersion, addendaCount: addenda.length })
    } catch (e: any) {
      console.error('extend-guide error:', e?.message || e)
      res.status(500).json({ error: 'Не удалось обновить гайд' })
    }
  },

  async refreshCache(_req: Request, res: Response) {
    invalidatePromptCache()
    res.json({ ok: true })
  },
}
