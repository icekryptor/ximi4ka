import { Request, Response } from 'express'
import { buildCashflowReport, Granularity } from '../services/cashflow.service'

export const cashflowController = {
  async report(req: Request, res: Response): Promise<void> {
    try {
      const { from, to, granularity, accounts, counterparty_id } = req.query
      if (!from || !to) { res.status(400).json({ error: 'from/to required' }); return }
      const accountIds = accounts ? String(accounts).split(',').filter(Boolean) : undefined

      const report = await buildCashflowReport({
        from: String(from),
        to: String(to),
        granularity: (String(granularity || 'month')) as Granularity,
        account_ids: accountIds,
        counterparty_id: counterparty_id ? String(counterparty_id) : undefined,
      })
      res.json(report)
    } catch (err: any) {
      console.error('[cashflow]', err)
      res.status(500).json({ error: err.message || 'Ошибка отчёта' })
    }
  },
}
