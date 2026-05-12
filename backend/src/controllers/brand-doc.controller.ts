import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'

const repo = AppDataSource.getRepository(BrandDoc)

export const brandDocController = {
  async getAll(_req: Request, res: Response) {
    try {
      const docs = await repo.find({ order: { slug: 'ASC' } })
      res.json(docs)
    } catch (error) {
      console.error('Ошибка при получении brand_docs:', error)
      res.status(500).json({ error: 'Ошибка при получении документов' })
    }
  },

  async getBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params
      const doc = await repo.findOne({ where: { slug } })
      if (!doc) {
        return res.status(404).json({ error: 'Документ не найден' })
      }
      res.json(doc)
    } catch (error) {
      console.error('Ошибка при получении документа:', error)
      res.status(500).json({ error: 'Ошибка при получении документа' })
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { slug } = req.params
      const { title, content, version } = req.body
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Поле content обязательно (string)' })
      }
      const existing = await repo.findOne({ where: { slug } })
      if (existing) {
        await repo.update(existing.id, {
          title: title ?? existing.title,
          content,
          version: version ?? existing.version,
        })
        const updated = await repo.findOne({ where: { slug } })
        return res.json(updated)
      }
      const created = repo.create({
        slug,
        title: title ?? slug,
        content,
        version: version ?? null,
      })
      const saved = await repo.save(created)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Ошибка при сохранении документа:', error)
      res.status(500).json({ error: 'Ошибка при сохранении документа' })
    }
  },
}
