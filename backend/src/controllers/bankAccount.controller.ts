import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankAccount } from '../entities/BankAccount'

const repo = () => AppDataSource.getRepository(BankAccount)

export const bankAccountController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await repo().find({ order: { created_at: 'ASC' } })
      res.json(items)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка загрузки счетов' })
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, bank_code, account_number, currency, opening_balance, opening_date } = req.body
      if (!name || !bank_code) { res.status(400).json({ error: 'name и bank_code обязательны' }); return }
      const item = repo().create({
        name, bank_code,
        account_number: account_number || null,
        currency: currency || 'RUB',
        opening_balance: opening_balance ?? 0,
        opening_date: opening_date || null,
        is_active: true,
      })
      const saved = await repo().save(item)
      res.status(201).json(saved)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const account = await repo().findOne({ where: { id } })
      if (!account) { res.status(404).json({ error: 'Не найден' }); return }
      const fields = ['name','bank_code','account_number','currency','opening_balance','opening_date','is_active'] as const
      for (const f of fields) if (req.body[f] !== undefined) (account as any)[f] = req.body[f]
      const saved = await repo().save(account)
      res.json(saved)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const result = await repo().delete(id)
      if (result.affected === 0) { res.status(404).json({ error: 'Не найден' }); return }
      res.json({ success: true })
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
