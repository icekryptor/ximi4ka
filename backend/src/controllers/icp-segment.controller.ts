import { Request, Response } from 'express'
import type { FindOptionsWhere } from 'typeorm'
import { AppDataSource } from '../config/database'
import { IcpSegment } from '../entities/IcpSegment'

const repo = AppDataSource.getRepository(IcpSegment)

export const icpSegmentController = {
  async getAll(req: Request, res: Response) {
    try {
      const { active } = req.query
      const where: FindOptionsWhere<IcpSegment> = {}
      if (active !== undefined) where.active = active === 'true'
      const segments = await repo.find({
        where,
        order: { sort_order: 'ASC', name: 'ASC' },
      })
      res.json(segments)
    } catch (error) {
      console.error('Ошибка при получении ICP-сегментов:', error)
      res.status(500).json({ error: 'Ошибка при получении сегментов' })
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const segment = await repo.findOne({ where: { id } })
      if (!segment) return res.status(404).json({ error: 'Сегмент не найден' })
      res.json(segment)
    } catch (error) {
      console.error('Ошибка при получении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при получении сегмента' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const segment = repo.create(req.body)
      const saved = await repo.save(segment)
      res.status(201).json(saved)
    } catch (error: unknown) {
      console.error('Ошибка при создании сегмента:', error)
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Сегмент с таким slug уже существует'
        : 'Ошибка при создании сегмента'
      res.status(500).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const segment = await repo.findOne({ where: { id } })
      if (!segment) return res.status(404).json({ error: 'Сегмент не найден' })
      await repo.update(id, req.body)
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (error) {
      console.error('Ошибка при обновлении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при обновлении сегмента' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Сегмент не найден' })
      res.json({ message: 'Сегмент удалён' })
    } catch (error) {
      console.error('Ошибка при удалении сегмента:', error)
      res.status(500).json({ error: 'Ошибка при удалении сегмента' })
    }
  },
}
