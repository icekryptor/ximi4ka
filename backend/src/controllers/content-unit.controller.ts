import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'

const repo = () => AppDataSource.getRepository(ContentUnit)

export const contentUnitController = {
  async getAll(req: Request, res: Response) {
    try {
      const items = await repo().find({
        order: { created_at: 'DESC' },
      })
      res.json(items)
    } catch (error) {
      console.error('Error fetching content units:', error)
      res.status(500).json({ error: 'Ошибка загрузки единиц контента' })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Не найдено' })
      res.json(item)
    } catch (error) {
      console.error('Error fetching content unit:', error)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId
      const item = repo().create({
        ...req.body,
        created_by: userId,
      })
      const saved = await repo().save(item)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Error creating content unit:', error)
      res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo().findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Не найдено' })
      repo().merge(item, req.body)
      const saved = await repo().save(item)
      res.json(saved)
    } catch (error) {
      console.error('Error updating content unit:', error)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo().delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Не найдено' })
      res.json({ success: true })
    } catch (error) {
      console.error('Error deleting content unit:', error)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
