import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'
import { Channel } from '../entities/Channel'
import { getPublisher } from '../services/publishers/registry'
import type { PublisherLog } from '../services/publishers/types'
import { emptyPublisherLog } from '../services/publishers/types'

const repo = AppDataSource.getRepository(ContentPublication)

async function resolveChannelId(body: Record<string, unknown>): Promise<void> {
  if (body.channel_id || !body.network) return // already resolved or no slug
  const channel = await AppDataSource.getRepository(Channel).findOne({
    where: { slug: String(body.network) },
  })
  if (channel) body.channel_id = channel.id
}

export const contentPublicationController = {
  /**
   * Returns simple activity counters for the dashboard «Пульс» strip:
   *  - scheduled_today: publications with scheduled_at falling within today
   *  - published_today: publications with published_at falling within today
   *  - avg_published_7d: average daily published count over the last 7 days
   *
   * Used by the «Пульс» inline component in the content-bank header to
   * surface a single-line activity heartbeat with delta vs 7-day average.
   */
  async pulse(_req: Request, res: Response) {
    try {
      const result = await repo.manager.query<Array<{
        scheduled_today: string
        published_today: string
        avg_published_7d: string
      }>>(
        `WITH today AS (
           SELECT
             COUNT(*) FILTER (
               WHERE scheduled_at >= date_trunc('day', NOW())
                 AND scheduled_at < date_trunc('day', NOW()) + INTERVAL '1 day'
             ) AS scheduled_today,
             COUNT(*) FILTER (
               WHERE published_at >= date_trunc('day', NOW())
                 AND published_at < date_trunc('day', NOW()) + INTERVAL '1 day'
             ) AS published_today
           FROM content_publications
         ),
         last7 AS (
           SELECT
             COUNT(*) FILTER (
               WHERE published_at >= date_trunc('day', NOW()) - INTERVAL '7 days'
                 AND published_at < date_trunc('day', NOW())
             ) AS published_last_7
           FROM content_publications
         )
         SELECT
           today.scheduled_today,
           today.published_today,
           (last7.published_last_7::float / 7) AS avg_published_7d
         FROM today, last7`,
      )
      const row = result[0] ?? { scheduled_today: '0', published_today: '0', avg_published_7d: '0' }
      res.json({
        scheduled_today: Number(row.scheduled_today),
        published_today: Number(row.published_today),
        avg_published_7d: Number(row.avg_published_7d),
      })
    } catch (e: any) {
      console.error('[content-publications.pulse] FAILED', 'message=', e?.message, '\nstack=', e?.stack)
      res.status(500).json({ error: 'Не удалось загрузить пульс' })
    }
  },

  /**
   * Returns all publications whose scheduled_at falls within "today" (UTC).
   * Joined with content_units for unit title and `script_text` (used to
   * derive has_video flag client-side via video_url presence).
   *
   * Used by TodayQueue on the content-bank dashboard. Bypasses the Edge
   * Function dashboard cache so the queue reflects publish-state changes
   * immediately after operator action.
   */
  async todayList(_req: Request, res: Response) {
    try {
      const items = await repo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.content_unit', 'u')
        .where("p.scheduled_at >= date_trunc('day', NOW())")
        .andWhere("p.scheduled_at < date_trunc('day', NOW()) + INTERVAL '1 day'")
        .orderBy('p.scheduled_at', 'ASC')
        .getMany()
      res.json(items)
    } catch (e: any) {
      console.error(
        '[content-publications.todayList] FAILED',
        'message=', e?.message,
        '\nstack=', e?.stack,
      )
      res.status(500).json({ error: 'Не удалось загрузить очередь публикаций' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      await resolveChannelId(req.body)
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
      await resolveChannelId(req.body)
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
      if (pub.published_at) {
        return res.status(409).json({ error: 'Публикация уже опубликована' })
      }
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

      const prev = (pub.publisher_log as PublisherLog | null) ?? emptyPublisherLog()
      await repo.update(pub.id, {
        published_at: new Date(),
        published_url: result.published_url,
        publisher_log: {
          ...prev,
          attempts: prev.attempts + 1,
          success: true,
          last_error: null,
          last_attempt_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          gave_up: false,
          manual: true,
          raw: result.raw_response,
        } satisfies PublisherLog as unknown as Record<string, unknown> as any,
      })
      const updated = await repo.findOne({ where: { id } })
      res.json(updated)
    } catch (e: any) {
      console.error('Ошибка ручной публикации:', e)
      try {
        if (req.params.id) {
          const pub = await repo.findOne({ where: { id: req.params.id } })
          if (pub) {
            const prev = (pub.publisher_log as PublisherLog | null) ?? emptyPublisherLog()
            await repo.update(pub.id, {
              publisher_log: {
                ...prev,
                attempts: prev.attempts + 1,
                success: false,
                last_error: String(e?.message ?? e),
                last_attempt_at: new Date().toISOString(),
                manual: true,
              } satisfies PublisherLog as unknown as Record<string, unknown> as any,
            })
          }
        }
      } catch (logErr) {
        console.error('Не удалось записать publisher_log:', logErr)
      }
      res.status(500).json({ error: e?.message || 'Ошибка публикации' })
    }
  },
}
