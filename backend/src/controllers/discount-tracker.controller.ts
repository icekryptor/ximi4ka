import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { syncWbOrders, dailyRows, orderRows } from '../services/spp-orders/spp-orders.service';

/** Приводим numeric-поля дневного агрегата к числам. */
const mapDaily = (r: any) => ({
  ...r,
  orders_count: Number(r.orders_count),
  avg_spp_pct: num(r.avg_spp_pct),
  median_spp_pct: num(r.median_spp_pct),
  min_spp_pct: num(r.min_spp_pct),
  max_spp_pct: num(r.max_spp_pct),
  avg_buyer_price: num(r.avg_buyer_price),
  avg_seller_price: num(r.avg_seller_price),
});

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Последний снапшот по каждому SKU + название товара (WB — из wb_financial_stats). */
async function fetchLatestRows(): Promise<any[]> {
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
  return rows.map((r: any) => ({
    ...r,
    seller_price: num(r.seller_price),
    shelf_price: num(r.shelf_price),
    platform_disc: num(r.platform_disc),
    platform_pct: num(r.platform_pct),
    discount_pct: num(r.discount_pct),
  }));
}

/** Почасовое среднее по каждому (platform, sku, час) за последние N часов. */
async function fetchHourlyRows(hours: number): Promise<any[]> {
  const h = Math.max(1, Math.min(hours || 24, 24 * 30));
  const rows = await AppDataSource.query(
    `SELECT
       ps.platform, ps.sku,
       date_trunc('hour', ps.captured_at) AS hour,
       avg(ps.platform_pct)  AS avg_platform_pct,
       avg(ps.discount_pct)  AS avg_discount_pct,
       avg(ps.shelf_price)   AS avg_shelf_price,
       avg(ps.seller_price)  AS avg_seller_price,
       count(*)              AS samples,
       CASE WHEN ps.platform = 'wb' THEN COALESCE(w.product_name, ps.sku) ELSE ps.sku END AS product_name
     FROM price_snapshots ps
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE ps.platform = 'wb' AND s.nm_id::text = ps.sku
         AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     WHERE ps.captured_at > now() - make_interval(hours => $1::int)
     GROUP BY ps.platform, ps.sku, date_trunc('hour', ps.captured_at), product_name
     ORDER BY hour DESC, ps.platform, ps.sku`,
    [h],
  );
  return rows.map((r: any) => ({
    ...r,
    avg_platform_pct: num(r.avg_platform_pct),
    avg_discount_pct: num(r.avg_discount_pct),
    avg_shelf_price: num(r.avg_shelf_price),
    avg_seller_price: num(r.avg_seller_price),
    samples: Number(r.samples),
  }));
}


/**
 * Сводная матрица СПП: (артикул продавца × дата) → СПП%.
 * WB — фактическая СПП по заказам (v_spp_daily, avg_spp_pct), артикул из mp_ad_daily.
 * Ozon — скидка площадки из витринных снапшотов (price_snapshots, дневное avg platform_pct),
 * sku там уже является артикулом продавца.
 */
async function fetchSppMatrix(platform: string, days: number): Promise<any[]> {
  const d = Math.max(1, Math.min(days || 30, 120));
  if (platform === 'ozon') {
    const rows = await AppDataSource.query(
      `SELECT sku, sku AS article, sku AS product_name,
              captured_at::date::text AS date,
              avg(platform_pct) * 100 AS spp_pct, count(*) AS samples
       FROM price_snapshots
       WHERE platform='ozon' AND captured_at > now() - make_interval(days => $1::int)
       GROUP BY sku, captured_at::date
       ORDER BY sku, date`,
      [d],
    );
    return rows.map((r: any) => ({ ...r, spp_pct: num(r.spp_pct), samples: Number(r.samples) }));
  }
  const rows = await AppDataSource.query(
    `SELECT v.nm_id::text AS sku,
            COALESCE(a.seller_article, v.nm_id::text) AS article,
            COALESCE(w.product_name, v.nm_id::text)   AS product_name,
            v.order_date::text AS date,
            v.avg_spp_pct * 100 AS spp_pct, v.orders_count AS samples
     FROM v_spp_daily v
     LEFT JOIN (SELECT sku, max(seller_article) AS seller_article FROM mp_ad_daily
                WHERE platform='wb' AND seller_article IS NOT NULL GROUP BY sku) a ON a.sku = v.nm_id::text
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE s.nm_id::text = v.nm_id::text AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     WHERE v.platform='wb' AND v.order_date > (now() - make_interval(days => $1::int))::date
     ORDER BY article, date`,
    [d],
  );
  return rows.map((r: any) => ({ ...r, spp_pct: num(r.spp_pct), samples: Number(r.samples) }));
}

export const discountTrackerController = {
  /** Последний снапшот по каждому SKU + название товара (WB — из wb_financial_stats, Ozon — sku) */
  async latest(_req: Request, res: Response) {
    try {
      res.json(await fetchLatestRows());
    } catch (e: any) {
      console.error('[discount-tracker.latest]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки снапшотов цен' });
    }
  },

  /** Почасовое среднее СПП за N часов (по умолчанию 24) */
  async hourly(req: Request, res: Response) {
    try {
      const hours = Number((req.query.hours as string) || '24');
      res.json(await fetchHourlyRows(hours));
    } catch (e: any) {
      console.error('[discount-tracker.hourly]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки почасового среднего' });
    }
  },

  /**
   * Публичный read-only снимок для менеджера ВБ. Токен в URL сверяется с
   * SPP_PUBLIC_TOKEN. Неверный/отсутствующий → 403 (НЕ 401 — иначе фронтовый
   * axios-интерсептор сделает auto-logout).
   */
  async publicShare(req: Request, res: Response) {
    const expected = process.env.SPP_PUBLIC_TOKEN;
    const got = req.params.token;
    if (!expected) return res.status(503).json({ error: 'Публичный доступ не настроен' });
    if (!got || got !== expected) return res.status(403).json({ error: 'Доступ запрещён' });
    try {
      // Фактическая СПП по заказам, дневные агрегаты, только WB.
      const days = Number((req.query.days as string) || '30');
      const daily = (await dailyRows('wb', days)).map(mapDaily);
      res.json({ daily, generated_at: new Date().toISOString() });
    } catch (e: any) {
      console.error('[discount-tracker.publicShare]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
  },

  /** Дневные агрегаты фактической СПП по заказам (v_spp_daily). */
  async sppDaily(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || null;
      const days = Number((req.query.days as string) || '30');
      const rows = (await dailyRows(platform, days)).map(mapDaily);
      res.json(rows);
    } catch (e: any) {
      console.error('[discount-tracker.sppDaily]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки дневной СПП' });
    }
  },

  /** Сырьё по заказам за день (распределение СПП). */
  async sppOrders(req: Request, res: Response) {
    try {
      const { platform, sku, date } = req.query as { platform?: string; sku?: string; date?: string };
      if (!platform || !sku || !date) {
        return res.status(400).json({ error: 'platform, sku и date обязательны' });
      }
      const rows = (await orderRows(platform, sku, date)).map((r: any) => ({
        ...r,
        seller_price: num(r.seller_price),
        buyer_price: num(r.buyer_price),
        spp_pct: num(r.spp_pct),
      }));
      res.json(rows);
    } catch (e: any) {
      console.error('[discount-tracker.sppOrders]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки заказов' });
    }
  },

  /**
   * Ручной синк фактической СПП по заказам (WB). WB Statistics /orders
   * лимитирован 1 req/min → синк может занять больше 30с (таймаут axios).
   * Поэтому запускаем в фоне и сразу отвечаем; данные подтянутся через ~минуту.
   */
  async sppSync(req: Request, res: Response) {
    const days = Number((req.body?.days as number) || 14);
    syncWbOrders(days)
      .then((r) => console.log('[spp-orders] manual sync done:', r))
      .catch((e) => console.error('[spp-orders] manual sync failed:', e?.message || e));
    res.json({ ok: true, started: true });
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

/** Сводная матрица СПП (артикул × дата) для страницы трекера. */
  async sppMatrix(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) === 'ozon' ? 'ozon' : 'wb';
      const days = Number((req.query.days as string) || '30');
      res.json({ platform, rows: await fetchSppMatrix(platform, days), generated_at: new Date().toISOString() });
    } catch (e: any) {
      console.error('[discount-tracker.sppMatrix]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки матрицы СПП' });
    }
  },

  /** Публичная (по токену) сводная матрица СПП — для share-ссылки. */
  async publicSppMatrix(req: Request, res: Response) {
    const expected = process.env.SPP_PUBLIC_TOKEN;
    const got = req.params.token;
    if (!expected) return res.status(503).json({ error: 'Публичный доступ не настроен' });
    if (!got || got !== expected) return res.status(403).json({ error: 'Доступ запрещён' });
    try {
      const platform = (req.query.platform as string) === 'ozon' ? 'ozon' : 'wb';
      const days = Number((req.query.days as string) || '30');
      res.json({ platform, rows: await fetchSppMatrix(platform, days), generated_at: new Date().toISOString() });
    } catch (e: any) {
      console.error('[discount-tracker.publicSppMatrix]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
  },

  /** Инфо для кнопки «Поделиться» (только admin-зона): готовый публичный путь. */
  async shareInfo(_req: Request, res: Response) {
    const token = process.env.SPP_PUBLIC_TOKEN;
    if (!token) return res.json({ configured: false, path: null });
    res.json({ configured: true, path: `/p/spp/${token}` });
  },

};
