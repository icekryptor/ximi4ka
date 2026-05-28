import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'

export const okrLinksController = {
  /**
   * Aggregate counts of linked projects and tasks per KR.
   * Returns: Record<krId, { projects: number; tasks: number }>
   *
   * Used by /marketing/okr page to render «📁 N · ✓ M» badges next to each KR.
   * Cheap query — partial indexes idx_*_okr_kr_id make GROUP BY fast even with
   * thousands of rows total.
   */
  async counts(_req: Request, res: Response) {
    try {
      const projectRows = await AppDataSource.query<Array<{ okr_kr_id: string; n: string }>>(
        `SELECT okr_kr_id, COUNT(*)::text AS n
         FROM projects
         WHERE okr_kr_id IS NOT NULL
         GROUP BY okr_kr_id`,
      )
      const taskRows = await AppDataSource.query<Array<{ okr_kr_id: string; n: string }>>(
        `SELECT okr_kr_id, COUNT(*)::text AS n
         FROM tasks
         WHERE okr_kr_id IS NOT NULL
         GROUP BY okr_kr_id`,
      )

      const result: Record<string, { projects: number; tasks: number }> = {}
      for (const row of projectRows) {
        result[row.okr_kr_id] = { projects: Number(row.n), tasks: 0 }
      }
      for (const row of taskRows) {
        if (!result[row.okr_kr_id]) {
          result[row.okr_kr_id] = { projects: 0, tasks: Number(row.n) }
        } else {
          result[row.okr_kr_id].tasks = Number(row.n)
        }
      }
      res.json(result)
    } catch (e: any) {
      console.error('[okr-links.counts]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки счётчиков OKR-связок' })
    }
  },
}
