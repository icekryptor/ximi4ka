import { Request, Response } from 'express'
import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import type { FindOptionsWhere } from 'typeorm'
import { AppDataSource } from '../config/database'
import { ChannelBudget } from '../entities/ChannelBudget'

const repo = AppDataSource.getRepository(ChannelBudget)

export const channelBudgetController = {
  async getAll(req: Request, res: Response) {
    try {
      const { channel_id, from, to } = req.query
      const where: FindOptionsWhere<ChannelBudget> = {}
      if (channel_id) where.channel_id = channel_id as string
      // Filter is OVERLAP semantic: budget touching the requested [from, to] range, not contained in it.
      // Operator mental model: "show budgets active during this period" → overlap. Adjust if you need containment.
      if (from) where.period_end = MoreThanOrEqual(from as string)
      if (to) where.period_start = LessThanOrEqual(to as string)
      const budgets = await repo.find({
        where,
        relations: ['channel'],
        order: { period_start: 'DESC' },
      })
      res.json(budgets)
    } catch (error) {
      console.error('Ошибка при получении бюджетов:', error)
      res.status(500).json({ error: 'Ошибка при получении бюджетов' })
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const budget = await repo.findOne({ where: { id }, relations: ['channel'] })
      if (!budget) return res.status(404).json({ error: 'Бюджет не найден' })
      res.json(budget)
    } catch (error) {
      console.error('Ошибка при получении бюджета:', error)
      res.status(500).json({ error: 'Ошибка при получении бюджета' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const budget = repo.create(req.body)
      const saved = await repo.save(budget)
      res.status(201).json(saved)
    } catch (error: unknown) {
      console.error('Ошибка при создании бюджета:', error)
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Бюджет на этот период для канала уже задан'
        : 'Ошибка при создании бюджета'
      res.status(500).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const budget = await repo.findOne({ where: { id } })
      if (!budget) return res.status(404).json({ error: 'Бюджет не найден' })
      await repo.update(id, req.body)
      const updated = await repo.findOne({ where: { id }, relations: ['channel'] })
      res.json(updated)
    } catch (error) {
      console.error('Ошибка при обновлении бюджета:', error)
      res.status(500).json({ error: 'Ошибка при обновлении бюджета' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Бюджет не найден' })
      res.json({ message: 'Бюджет удалён' })
    } catch (error) {
      console.error('Ошибка при удалении бюджета:', error)
      res.status(500).json({ error: 'Ошибка при удалении бюджета' })
    }
  },
}
