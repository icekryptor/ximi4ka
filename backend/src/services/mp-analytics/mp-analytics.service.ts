/**
 * Аналитика маркетплейсов (воронка + продажи) по дням. WB — nm-report/detail/history.
 * Ozon — этап 2 (/v1/analytics/data), та же таблица mp_funnel_daily.
 */

import { AppDataSource } from '../../config/database';
import { wbApiService, WbNmHistoryPoint } from '../wb-api.service';

const INSERT_CHUNK = 500;

type FunnelRow = {
  platform: 'wb' | 'ozon';
  date: string;
  sku: string;
  views: number | null;
  cart: number | null;
  orders_count: number | null;
  orders_sum: number | null;
  buyouts_count: number | null;
  buyouts_sum: number | null;
  cancels_count: number | null;
  returns_count: number | null;
  cart_conv: number | null;
  order_conv: number | null;
  buyout_percent: number | null;
  avg_price: number | null;
  stock_end: number | null;
  raw: unknown;
};

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

function mapWbPoint(sku: string, p: WbNmHistoryPoint): FunnelRow {
  return {
    platform: 'wb',
    date: (p.dt || '').slice(0, 10),
    sku,
    views: n(p.openCardCount),
    cart: n(p.addToCartCount),
    orders_count: n(p.ordersCount),
    orders_sum: n(p.ordersSumRub),
    buyouts_count: n(p.buyoutsCount),
    buyouts_sum: n(p.buyoutsSumRub),
    cancels_count: n(p.cancelCount),
    returns_count: null,
    cart_conv: n(p.addToCartConversion),
    order_conv: n(p.cartToOrderConversion),
    buyout_percent: n(p.buyoutPercent),
    avg_price: n(p.avgPriceRub),
    stock_end: null,
    raw: p,
  };
}

async function upsert(rows: FunnelRow[]): Promise<number> {
  const clean = rows.filter((r) => r.date && r.sku);
  for (let i = 0; i < clean.length; i += INSERT_CHUNK) {
    const chunk = clean.slice(i, i + INSERT_CHUNK);
    const cols = 17;
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((r, idx) => {
      const b = idx * cols;
      // 16 обычных плейсхолдеров + 17-й (raw) с ::jsonb
      const ph = Array.from({ length: cols - 1 }, (_, k) => `$${b + k + 1}`);
      ph.push(`$${b + cols}::jsonb`);
      values.push('(' + ph.join(',') + ')');
      params.push(
        r.platform, r.date, r.sku, r.views, r.cart, r.orders_count, r.orders_sum,
        r.buyouts_count, r.buyouts_sum, r.cancels_count, r.returns_count,
        r.cart_conv, r.order_conv, r.buyout_percent, r.avg_price, r.stock_end,
        JSON.stringify(r.raw ?? null),
      );
    });
    await AppDataSource.query(
      `INSERT INTO mp_funnel_daily
         (platform, date, sku, views, cart, orders_count, orders_sum,
          buyouts_count, buyouts_sum, cancels_count, returns_count,
          cart_conv, order_conv, buyout_percent, avg_price, stock_end, raw)
       VALUES ${values.join(',')}
       ON CONFLICT (platform, sku, date) DO UPDATE SET
         views=EXCLUDED.views, cart=EXCLUDED.cart,
         orders_count=EXCLUDED.orders_count, orders_sum=EXCLUDED.orders_sum,
         buyouts_count=EXCLUDED.buyouts_count, buyouts_sum=EXCLUDED.buyouts_sum,
         cancels_count=EXCLUDED.cancels_count, returns_count=EXCLUDED.returns_count,
         cart_conv=EXCLUDED.cart_conv, order_conv=EXCLUDED.order_conv,
         buyout_percent=EXCLUDED.buyout_percent, avg_price=EXCLUDED.avg_price,
         stock_end=EXCLUDED.stock_end, raw=EXCLUDED.raw, synced_at=now()`,
      params,
    );
  }
  return clean.length;
}

/** Импорт готовых строк (бэкофилл из xlsx-отчёта, минуя API). */
export async function importFunnelRows(
  platform: 'wb' | 'ozon',
  input: Array<Partial<FunnelRow> & { date: string; sku: string }>,
): Promise<number> {
  const rows: FunnelRow[] = input.map((r) => ({
    platform,
    date: String(r.date).slice(0, 10),
    sku: String(r.sku),
    views: r.views ?? null,
    cart: r.cart ?? null,
    orders_count: r.orders_count ?? null,
    orders_sum: r.orders_sum ?? null,
    buyouts_count: r.buyouts_count ?? null,
    buyouts_sum: r.buyouts_sum ?? null,
    cancels_count: r.cancels_count ?? null,
    returns_count: r.returns_count ?? null,
    cart_conv: r.cart_conv ?? null,
    order_conv: r.order_conv ?? null,
    buyout_percent: r.buyout_percent ?? null,
    avg_price: r.avg_price ?? null,
    stock_end: r.stock_end ?? null,
    raw: r.raw ?? null,
  }));
  return upsert(rows);
}

/** nmId'ы, по которым тянем аналитику (все известные из финстата). */
async function wbNmIds(): Promise<number[]> {
  const rows = await AppDataSource.query(`SELECT DISTINCT nm_id FROM wb_financial_stats`);
  return rows.map((r: any) => Number(r.nm_id)).filter(Boolean);
}

/** Синхронизировать WB-воронку за последние `days` дней. */
export async function syncWbFunnel(days = 30): Promise<{ items: number; upserted: number }> {
  const nmIds = await wbNmIds();
  if (!nmIds.length) return { items: 0, upserted: 0 };
  const end = new Date();
  const begin = new Date();
  begin.setDate(begin.getDate() - Math.max(1, days));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const items = await wbApiService.getNmReportHistory(nmIds, fmt(begin), fmt(end));
  const rows: FunnelRow[] = [];
  for (const it of items) {
    for (const p of it.history || []) rows.push(mapWbPoint(String(it.nmID), p));
  }
  const upserted = rows.length ? await upsert(rows) : 0;
  console.log(`[mp-analytics] WB funnel: items ${items.length}, upserted ${upserted}`);
  return { items: items.length, upserted };
}

/** Дневная таймсерия (platform, window) + название товара. */
export async function dailyRows(platform: string, days = 30): Promise<any[]> {
  const d = Math.max(1, Math.min(days, 400));
  return AppDataSource.query(
    `SELECT f.*, COALESCE(w.product_name, f.sku) AS product_name
     FROM mp_funnel_daily f
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE f.platform='wb' AND s.nm_id::text = f.sku
         AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     WHERE f.platform=$1 AND f.date > (now() - make_interval(days => $2::int))::date
     ORDER BY f.date DESC, f.sku`,
    [platform, d],
  );
}

/** Итоги по продуктам за период + доля + сравнение с предыдущим окном. */
export async function summaryByProduct(platform: string, days = 30): Promise<any[]> {
  const d = Math.max(1, Math.min(days, 400));
  return AppDataSource.query(
    `WITH cur AS (
       SELECT sku,
              sum(orders_sum)    AS orders_sum,
              sum(orders_count)  AS orders_count,
              sum(buyouts_sum)   AS buyouts_sum,
              sum(buyouts_count) AS buyouts_count,
              sum(views)         AS views
       FROM mp_funnel_daily
       WHERE platform=$1 AND date > (now() - make_interval(days => $2::int))::date
       GROUP BY sku
     ),
     prev AS (
       SELECT sku, sum(orders_sum) AS orders_sum_prev
       FROM mp_funnel_daily
       WHERE platform=$1
         AND date > (now() - make_interval(days => ($2*2)::int))::date
         AND date <= (now() - make_interval(days => $2::int))::date
       GROUP BY sku
     ),
     tot AS (SELECT NULLIF(sum(orders_sum),0) AS total FROM cur)
     SELECT c.sku,
            COALESCE(w.product_name, c.sku) AS product_name,
            c.orders_sum, c.orders_count, c.buyouts_sum, c.buyouts_count, c.views,
            round((c.orders_sum / (SELECT total FROM tot) * 100)::numeric, 1) AS share_pct,
            p.orders_sum_prev,
            round(((c.orders_sum - COALESCE(p.orders_sum_prev,0)))::numeric, 0) AS orders_sum_delta
     FROM cur c
     LEFT JOIN prev p ON p.sku = c.sku
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE $1='wb' AND s.nm_id::text = c.sku
         AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     ORDER BY c.orders_sum DESC NULLS LAST`,
    [platform, d],
  );
}
