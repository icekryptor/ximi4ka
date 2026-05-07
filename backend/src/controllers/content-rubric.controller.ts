import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentRubric } from '../entities/ContentRubric'

const repo = AppDataSource.getRepository(ContentRubric)

export const contentRubricController = {
  async getAll(req: Request, res: Response) {
    try {
      const items = await repo.find({ order: { sort_order: 'ASC', title: 'ASC' } })
      res.json(items)
    } catch (e) {
      console.error('Error fetching rubrics:', e)
      res.status(500).json({ error: 'Ошибка загрузки рубрик' })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Рубрика не найдена' })
      res.json(item)
    } catch (e) {
      console.error('Error fetching rubric:', e)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const item = repo.create(req.body)
      const saved = await repo.save(item)
      res.status(201).json(saved)
    } catch (e: any) {
      console.error('Error creating rubric:', e)
      const msg = e?.code === '23505' ? 'Рубрика с таким slug уже существует' : 'Ошибка создания'
      res.status(400).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Рубрика не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({ where: { id: req.params.id } })
      res.json(updated)
    } catch (e) {
      console.error('Error updating rubric:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Рубрика не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting rubric:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
