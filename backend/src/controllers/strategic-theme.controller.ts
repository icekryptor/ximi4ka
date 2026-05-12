import { Request, Response } from 'express'
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import { AppDataSource } from '../config/database'
import { StrategicTheme } from '../entities/StrategicTheme'

const repo = AppDataSource.getRepository(StrategicTheme)

export const strategicThemeController = {
  async getAll(req: Request, res: Response) {
    try {
      const { current } = req.query
      if (current === 'true') {
        const today = new Date().toISOString().slice(0, 10)
        const themes = await repo.find({
          where: [
            { active_from: IsNull() },
            { active_from: LessThanOrEqual(today), active_to: IsNull() },
            { active_from: LessThanOrEqual(today), active_to: MoreThanOrEqual(today) },
          ],
          order: { sort_order: 'ASC', name: 'ASC' },
        })
        return res.json(themes)
      }
      const themes = await repo.find({
        order: { sort_order: 'ASC', name: 'ASC' },
      })
      res.json(themes)
    } catch (error) {
      console.error('Ошибка при получении стратегических тем:', error)
      res.status(500).json({ error: 'Ошибка при получении тем' })
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const theme = await repo.findOne({ where: { id } })
      if (!theme) return res.status(404).json({ error: 'Тема не найдена' })
      res.json(theme)
    } catch (error) {
      console.error('Ошибка при получении темы:', error)
      res.status(500).json({ error: 'Ошибка при получении темы' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const theme = repo.create(req.body)
      const saved = await repo.save(theme)
      res.status(201).json(saved)
    } catch (error: unknown) {
      console.error('Ошибка при создании темы:', error)
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Тема с таким slug уже существует'
        : 'Ошибка при создании темы'
      res.status(500).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const theme = await repo.findOne({ where: { id } })
      if (!theme) return res.status(404).json({ error: 'Тема не найдена' })
      await repo.update(id, req.body)
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (error) {
      console.error('Ошибка при обновлении темы:', error)
      res.status(500).json({ error: 'Ошибка при обновлении темы' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Тема не найдена' })
      res.json({ message: 'Тема удалена' })
    } catch (error) {
      console.error('Ошибка при удалении темы:', error)
      res.status(500).json({ error: 'Ошибка при удалении темы' })
    }
  },
}
