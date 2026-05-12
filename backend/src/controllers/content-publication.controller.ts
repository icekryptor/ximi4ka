import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'
import { getPublisher } from '../services/publishers/registry'

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

  async publishNow(req: Request, res: Response) {
    try {
      const { id } = req.params
      const pub = await repo.findOne({
        where: { id },
        relations: ['channel', 'content_unit'],
      })
      if (!pub) return res.status(404).json({ error: 'Публикация не найдена' })
      if (!pub.channel) return res.status(400).json({ error: 'У публикации не задан channel_id' })
      if (!pub.content_unit) return res.status(400).json({ error: 'У публикации не найден content_unit' })

      const publisher = getPublisher(pub.channel.platform)
      if (!publisher) {
        return res.status(400).json({ error: `Publisher для "${pub.channel.platform}" не зарегистрирован` })
      }
      if (!publisher.canPublish({ unit: pub.content_unit, channel: pub.channel, publication: pub })) {
        return res.status(400).json({ error: 'Канал не готов к публикации (проверь config_json, например chat_id)' })
      }

      const result = await publisher.publish({
        unit: pub.content_unit,
        channel: pub.channel,
        publication: pub,
      })

      const attempts = (pub.publisher_log as any)?.attempts ?? 0
      await repo.update(pub.id, {
        published_at: new Date(),
        published_url: result.published_url,
        publisher_log: {
          ...((pub.publisher_log as any) || {}),
          success: true,
          attempts: attempts + 1,
          completed_at: new Date().toISOString(),
          raw: result.raw_response,
          manual: true,
        } as any,
      })
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (e: any) {
      console.error('Ошибка ручной публикации:', e)
      res.status(500).json({ error: e?.message || 'Ошибка публикации' })
    }
  },
}
