import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ImportRule } from '../entities/ImportRule'

const repo = () => AppDataSource.getRepository(ImportRule)

export const importRuleController = {
  async list(_req: Request, res: Response): Promise<void> {
    const items = await repo().createQueryBuilder('r')
      .leftJoinAndMapOne('r.counterparty', 'counterparties', 'cp', 'cp.id = r.counterparty_id')
      .leftJoinAndMapOne('r.category', 'categories', 'cat', 'cat.id = r.category_id')
      .orderBy('r.last_used_at', 'DESC', 'NULLS LAST')
      .getMany()
    res.json(items)
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const result = await repo().delete(id)
    if (result.affected === 0) { res.status(404).json({ error: 'Не найдено' }); return }
    res.json({ success: true })
  },
}
