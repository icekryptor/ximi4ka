import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { runOnce } from '../services/discount-tracker/discount-tracker.service';

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export const discountTrackerController = {
  /** Последний снапшот по каждому SKU + название товара (WB — из wb_financial_stats, Ozon — sku) */
  async latest(_req: Request, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT
           v.platform, v.sku, v.captured_at, v.seller_price, v.shelf_price,
           v.platform_disc, v.platform_pct, v.discount_pct,
           CASE WHEN v.platform = 'wb' THEN COALESCE(w.product_name, v.sku) ELSE v.sku END AS product_name
         FROM v_price_latest v
         LEFT JOIN LATERAL (
           SELECT s.product_name
           FROM wb_financial_stats s
           WHERE v.platform = 'wb'
             AND s.nm_id::text = v.sku
             AND s.product_name IS NOT NULL AND s.product_name <> ''
           ORDER BY s.date DESC
           LIMIT 1
         ) w ON true
         ORDER BY v.platform, v.sku`,
      );
      res.json(
        rows.map((r: any) => ({
          ...r,
          seller_price: num(r.seller_price),
          shelf_price: num(r.shelf_price),
          platform_disc: num(r.platform_disc),
          platform_pct: num(r.platform_pct),
          discount_pct: num(r.discount_pct),
        })),
      );
    } catch (e: any) {
      console.error('[discount-tracker.latest]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки снапшотов цен' });
    }
  },

  /** История снапшотов по SKU за N часов (по умолчанию 48), по возрастанию времени */
  async history(req: Request, res: Response) {
    try {
      const { platform, sku, hours = '48' } = req.query as {
        platform?: string;
        sku?: string;
        hours?: string;
      };
      if (!platform || !sku) {
        return res.status(400).json({ error: 'platform и sku обязательны' });
      }
      const hoursNum = Math.max(1, Math.min(Number(hours) || 48, 24 * 30));
      const rows = await AppDataSource.query(
        `SELECT captured_at, platform, sku, seller_price, shelf_price,
                own_discount, platform_disc, discount_pct, platform_pct
         FROM price_snapshots
         WHERE platform = $1 AND sku = $2
           AND captured_at > now() - make_interval(hours => $3::int)
         ORDER BY captured_at ASC`,
        [platform, sku, hoursNum],
      );
      res.json(
        rows.map((r: any) => ({
          ...r,
          seller_price: num(r.seller_price),
          shelf_price: num(r.shelf_price),
          own_discount: num(r.own_discount),
          platform_disc: num(r.platform_disc),
          discount_pct: num(r.discount_pct),
          platform_pct: num(r.platform_pct),
        })),
      );
    } catch (e: any) {
      console.error('[discount-tracker.history]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки истории снапшотов' });
    }
  },

  /** Последние алерты (SKU, по которым уже пикали) */
  async alerts(_req: Request, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT platform, sku, last_pct, last_alerted
         FROM alert_state
         WHERE last_alerted IS NOT NULL
         ORDER BY last_alerted DESC
         LIMIT 50`,
      );
      res.json(rows.map((r: any) => ({ ...r, last_pct: num(r.last_pct) })));
    } catch (e: any) {
      console.error('[discount-tracker.alerts]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки алертов' });
    }
  },

  /** Ручной запуск прохода трекера */
  async run(_req: Request, res: Response) {
    try {
      const result = await runOnce();
      res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error('[discount-tracker.run]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка запуска трекера скидок') });
    }
  },
};
