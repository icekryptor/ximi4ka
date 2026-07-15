import { Request, Response } from 'express';
import { wbDashboard } from '../services/wb-dashboard.service';

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const wbDashboardController = {
  /** GET /api/dashboard/wb?days=7 | ?from&to — сводка главной страницы. */
  async overview(req: Request, res: Response) {
    try {
      let { from, to } = req.query as { from?: string; to?: string };
      if (!isDate(from) || !isDate(to)) {
        const days = Math.max(1, Math.min(Number(req.query.days) || 7, 120));
        const toD = new Date(Date.now() - 864e5); // по вчера — текущий день неполный
        const fromD = new Date(toD.getTime() - (days - 1) * 864e5);
        from = fromD.toISOString().slice(0, 10);
        to = toD.toISOString().slice(0, 10);
      }
      res.json(await wbDashboard({ from, to }));
    } catch (e: any) {
      console.error('[wb-dashboard]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки дашборда' });
    }
  },
};
