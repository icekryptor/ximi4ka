import { Request, Response } from 'express';
import { syncWbFunnel, dailyRows, summaryByProduct, importFunnelRows, adReport, importAdRows } from '../services/mp-analytics/mp-analytics.service';

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const NUM_FIELDS = [
  'views', 'cart', 'orders_count', 'orders_sum', 'buyouts_count', 'buyouts_sum',
  'cancels_count', 'returns_count', 'cart_conv', 'order_conv', 'buyout_percent',
  'avg_price', 'stock_end', 'share_pct', 'orders_sum_prev', 'orders_sum_delta',
  'spend', 'clicks', 'impressions', 'carts_ad', 'orders_ad', 'orders_sum_ad',
  'drr_orders', 'drr_buyouts', 'cpc', 'cost_cart', 'cost_order',
];
const mapNums = (r: any) => {
  const out = { ...r };
  for (const f of NUM_FIELDS) if (f in out) out[f] = num(out[f]);
  return out;
};

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const rangeFromQuery = (req: Request) => {
  const from = req.query.from;
  const to = req.query.to;
  if (isDate(from) && isDate(to)) return { from, to };
  return { days: Number((req.query.days as string) || '30') };
};

export const mpAnalyticsController = {
  /** Дневная таймсерия воронки/продаж. Период: days ИЛИ from&to (YYYY-MM-DD). */
  async daily(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await dailyRows(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.daily]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки дневной аналитики' });
    }
  },

  /** Итоги по продуктам + доли + сравнение с прошлым периодом. */
  async summary(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await summaryByProduct(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.summary]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки сводки' });
    }
  },

  /** Отчёт по рекламе по дням (ДРР, CPC, стоимость корзины/заказа). */
  async ads(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await adReport(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.ads]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки отчёта по рекламе' });
    }
  },

  /** Импорт дневной рекламы по источникам (au/apk/cpc) из РК-выгрузок. */
  async adImport(req: Request, res: Response) {
    try {
      const { platform, rows } = req.body as { platform?: 'wb' | 'ozon'; rows?: any[] };
      if ((platform !== 'wb' && platform !== 'ozon') || !Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'Нужны platform (wb|ozon) и непустой rows[]' });
      }
      res.json({ ok: true, upserted: await importAdRows(platform, rows) });
    } catch (e: any) {
      console.error('[mp-analytics.adImport]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка импорта рекламы') });
    }
  },

  /** Импорт готовых строк из отчёта (бэкофилл из xlsx). */
  async import(req: Request, res: Response) {
    try {
      const { platform, rows } = req.body as {
        platform?: 'wb' | 'ozon';
        rows?: Array<{ date: string; sku: string } & Record<string, number | null>>;
      };
      if ((platform !== 'wb' && platform !== 'ozon') || !Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'Нужны platform (wb|ozon) и непустой rows[]' });
      }
      const upserted = await importFunnelRows(platform, rows);
      res.json({ ok: true, upserted });
    } catch (e: any) {
      console.error('[mp-analytics.import]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка импорта') });
    }
  },

  /** Ручной синк WB-воронки (fire-and-forget: nm-report ~3 req/min, может >30с). */
  async sync(req: Request, res: Response) {
    const days = Number((req.body?.days as number) || 30);
    syncWbFunnel(days)
      .then((r) => console.log('[mp-analytics] manual sync done:', r))
      .catch((e) => console.error('[mp-analytics] manual sync failed:', e?.message || e));
    res.json({ ok: true, started: true });
  },
};
