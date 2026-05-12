import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Channel } from '../entities/Channel'
import { ContentPublication } from '../entities/ContentPublication'

const repo = AppDataSource.getRepository(Channel)

export const channelController = {
  async getAll(req: Request, res: Response) {
    try {
      const { platform, integration_status, active } = req.query
      const where: Record<string, unknown> = {}
      if (platform) where.platform = platform
      if (integration_status) where.integration_status = integration_status
      if (active !== undefined) where.active = active === 'true'
      const channels = await repo.find({
        where,
        order: { sort_order: 'ASC', display_name: 'ASC' },
      })
      res.json(channels)
    } catch (error) {
      console.error('Ошибка при получении каналов:', error)
      res.status(500).json({ error: 'Ошибка при получении каналов' })
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const channel = await repo.findOne({ where: { id } })
      if (!channel) return res.status(404).json({ error: 'Канал не найден' })
      res.json(channel)
    } catch (error) {
      console.error('Ошибка при получении канала:', error)
      res.status(500).json({ error: 'Ошибка при получении канала' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const channel = repo.create(req.body)
      const saved = await repo.save(channel)
      res.status(201).json(saved)
    } catch (error: unknown) {
      console.error('Ошибка при создании канала:', error)
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Канал с таким slug уже существует'
        : 'Ошибка при создании канала'
      res.status(500).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const channel = await repo.findOne({ where: { id } })
      if (!channel) return res.status(404).json({ error: 'Канал не найден' })
      await repo.update(id, req.body)
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (error) {
      console.error('Ошибка при обновлении канала:', error)
      res.status(500).json({ error: 'Ошибка при обновлении канала' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const publicationsCount = await AppDataSource
        .getRepository(ContentPublication)
        .count({ where: { channel_id: id } })
      if (publicationsCount > 0) {
        return res.status(409).json({ error: 'Канал используется в публикациях, удаление запрещено' })
      }
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Канал не найден' })
      res.json({ message: 'Канал удалён' })
    } catch (error) {
      console.error('Ошибка при удалении канала:', error)
      res.status(500).json({ error: 'Ошибка при удалении канала' })
    }
  },
}
