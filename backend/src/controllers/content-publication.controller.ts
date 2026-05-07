import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'

const repo = AppDataSource.getRepository(ContentPublication)

export const contentPublicationController = {
  async create(req: Request, res: Response) {
    try {
      const item = repo.create(req.body)
      const saved = await repo.save(item)
      res.status(201).json(saved)
    } catch (e: any) {
      console.error('Error creating publication:', e)
      const msg =
        e?.code === '23505'
          ? 'Публикация в этой соцсети уже добавлена'
          : 'Ошибка создания'
      res.status(400).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Публикация не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({ where: { id: req.params.id } })
      res.json(updated)
    } catch (e) {
      console.error('Error updating publication:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Публикация не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting publication:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
