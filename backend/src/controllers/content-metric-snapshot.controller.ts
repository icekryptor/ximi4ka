import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentMetricSnapshot } from '../entities/ContentMetricSnapshot'

const repo = AppDataSource.getRepository(ContentMetricSnapshot)

const VALID_CAPTURED_BY = ['worker', 'manual'] as const

export const contentMetricSnapshotController = {
  async listByPublication(req: Request, res: Response) {
    try {
      const { publication_id } = req.query
      if (!publication_id || typeof publication_id !== 'string') {
        return res.status(400).json({ error: 'publication_id обязателен' })
      }
      const snapshots = await repo.find({
        where: { publication_id },
        order: { captured_at: 'DESC' },
        take: 50,
      })
      res.json(snapshots)
    } catch (error) {
      console.error('Ошибка получения снимков метрик:', error)
      res.status(500).json({ error: 'Ошибка получения снимков' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>
      if (!body.publication_id || typeof body.publication_id !== 'string') {
        return res.status(400).json({ error: 'publication_id обязателен' })
      }
      if (body.captured_by !== undefined && !VALID_CAPTURED_BY.includes(body.captured_by as any)) {
        return res.status(400).json({ error: 'captured_by должен быть worker или manual' })
      }
      // Strip non-numeric values from metric fields
      const metricFields = ['views', 'likes', 'comments', 'shares', 'saves', 'profile_clicks', 'marketplace_clicks']
      for (const f of metricFields) {
        if (body[f] !== undefined && body[f] !== null && (typeof body[f] !== 'number' || !Number.isInteger(body[f]))) {
          return res.status(400).json({ error: `${f} должен быть целым числом или null` })
        }
      }
      const snapshot = repo.create({
        ...body,
        captured_by: (body.captured_by as 'worker' | 'manual') ?? 'manual',
      })
      const saved = await repo.save(snapshot)
      res.status(201).json(saved)
    } catch (error) {
      console.error('Ошибка сохранения снимка:', error)
      res.status(500).json({ error: 'Ошибка сохранения снимка' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await repo.delete(id)
      if (result.affected === 0) return res.status(404).json({ error: 'Снимок не найден' })
      res.json({ message: 'Снимок удалён' })
    } catch (error) {
      console.error('Ошибка удаления снимка:', error)
      res.status(500).json({ error: 'Ошибка удаления снимка' })
    }
  },

  async analytics(req: Request, res: Response) {
    try {
      const groupByMap: Record<string, string> = {
        content_type: 'u.content_type',
        channel_id: 'pub.channel_id',
        rubric_id: 'u.rubric_id',
        target_segment_id: 'u.target_segment_id',
        theme_id: 'u.theme_id',
      }
      const groupBy = String(req.query.group_by ?? 'content_type')
      const dimCol = groupByMap[groupBy]
      if (!dimCol) {
        return res.status(400).json({ error: `group_by должен быть одним из: ${Object.keys(groupByMap).join(', ')}` })
      }

      const params: Array<string | null> = [
        (req.query.content_type as string) || null,
        (req.query.channel_id as string) || null,
        (req.query.rubric_id as string) || null,
        (req.query.target_segment_id as string) || null,
        (req.query.theme_id as string) || null,
        (req.query.period_start as string) || null,
        (req.query.period_end as string) || null,
      ]

      const sql = `
        WITH latest_snapshot AS (
          SELECT DISTINCT ON (publication_id)
            publication_id, views, likes, comments, shares, saves,
            profile_clicks, marketplace_clicks
          FROM content_metric_snapshot
          ORDER BY publication_id, captured_at DESC
        )
        SELECT
          ${dimCol} AS group_key,
          COUNT(DISTINCT pub.id)::int AS publications,
          COALESCE(SUM(ls.views), 0)::int AS views,
          COALESCE(SUM(ls.likes), 0)::int AS likes,
          COALESCE(SUM(ls.comments), 0)::int AS comments,
          COALESCE(SUM(ls.shares), 0)::int AS shares,
          COALESCE(SUM(ls.saves), 0)::int AS saves,
          COALESCE(SUM(ls.profile_clicks), 0)::int AS profile_clicks,
          COALESCE(SUM(ls.marketplace_clicks), 0)::int AS marketplace_clicks
        FROM content_publications pub
        LEFT JOIN latest_snapshot ls ON ls.publication_id = pub.id
        LEFT JOIN content_units u ON u.id = pub.content_unit_id
        LEFT JOIN channel ch ON ch.id = pub.channel_id
        WHERE 1=1
          AND ($1::text IS NULL OR u.content_type = $1)
          AND ($2::uuid IS NULL OR pub.channel_id = $2)
          AND ($3::uuid IS NULL OR u.rubric_id = $3)
          AND ($4::uuid IS NULL OR u.target_segment_id = $4)
          AND ($5::uuid IS NULL OR u.theme_id = $5)
          AND ($6::timestamptz IS NULL OR pub.published_at >= $6)
          AND ($7::timestamptz IS NULL OR pub.published_at <= $7)
        GROUP BY ${dimCol}
        ORDER BY publications DESC, views DESC NULLS LAST
      `
      const rows = await AppDataSource.query(sql, params)
      res.json({ group_by: groupBy, rows })
    } catch (error) {
      console.error('Ошибка получения аналитики:', error)
      res.status(500).json({ error: 'Ошибка получения аналитики' })
    }
  },
}
