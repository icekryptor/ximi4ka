/**
 * Фактическая СПП по заказам. Источник WB — Statistics API /orders
 * (spp, finishedPrice, priceWithDisc per заказ). Точнее скрейпа витрины,
 * но частота дневная. Ozon — этап 2 (та же таблица spp_order).
 */

import { AppDataSource } from '../../config/database';
import { wbApiService, WbOrderRow } from '../wb-api.service';

const INSERT_CHUNK = 500;

type SppRow = {
  platform: 'wb' | 'ozon';
  nm_id: string;
  order_id: string;
  order_date: string; // YYYY-MM-DD
  seller_price: number | null;
  buyer_price: number | null;
  spp_pct: number | null; // доля 0..1
  region: string | null;
  is_cancel: boolean;
  raw: unknown;
};

/** WB order → строка spp_order. СПП из поля spp (%), fallback — по ценам. */
function mapWbOrder(o: WbOrderRow): SppRow {
  const seller = Number(o.priceWithDisc) || null;
  const buyer = Number(o.finishedPrice) || null;
  let spp: number | null = null;
  if (Number(o.spp) > 0) spp = Number(o.spp) / 100;
  else if (seller && buyer && seller > 0) spp = Math.max(0, 1 - buyer / seller);
  return {
    platform: 'wb',
    nm_id: String(o.nmId),
    order_id: o.srid,
    order_date: (o.date || '').slice(0, 10),
    seller_price: seller,
    buyer_price: buyer,
    spp_pct: spp,
    region: o.regionName || o.oblastOkrugName || null,
    is_cancel: !!o.isCancel,
    raw: o,
  };
}

async function upsert(rows: SppRow[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((r, idx) => {
      const b = idx * 10;
      values.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10}::jsonb)`,
      );
      params.push(
        r.platform,
        r.nm_id,
        r.order_id,
        r.order_date,
        r.seller_price,
        r.buyer_price,
        r.spp_pct,
        r.region,
        r.is_cancel,
        JSON.stringify(r.raw ?? null),
      );
    });
    await AppDataSource.query(
      `INSERT INTO spp_order
         (platform, nm_id, order_id, order_date, seller_price, buyer_price, spp_pct, region, is_cancel, raw)
       VALUES ${values.join(',')}
       ON CONFLICT (platform, order_id) DO UPDATE SET
         seller_price = EXCLUDED.seller_price,
         buyer_price  = EXCLUDED.buyer_price,
         spp_pct      = EXCLUDED.spp_pct,
         region       = EXCLUDED.region,
         is_cancel    = EXCLUDED.is_cancel,
         raw          = EXCLUDED.raw,
         synced_at    = now()`,
      params,
    );
    n += chunk.length;
  }
  return n;
}

/** Синхронизировать WB-заказы за последние `days` дней. */
export async function syncWbOrders(days = 14): Promise<{ fetched: number; upserted: number }> {
  const from = new Date();
  from.setDate(from.getDate() - Math.max(1, days));
  const dateFrom = from.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss

  const orders = await wbApiService.getOrders(dateFrom);
  const rows = orders.map(mapWbOrder).filter((r) => r.order_id);
  const upserted = rows.length ? await upsert(rows) : 0;
  console.log(`[spp-orders] WB: fetched ${orders.length}, upserted ${upserted} (from ${dateFrom})`);
  return { fetched: orders.length, upserted };
}

/** Дневные агрегаты из v_spp_daily + название товара. */
export async function dailyRows(platform: string | null, days = 30): Promise<any[]> {
  const d = Math.max(1, Math.min(days, 365));
  const params: unknown[] = [d];
  let platformFilter = '';
  if (platform) {
    params.push(platform);
    platformFilter = `AND v.platform = $${params.length}`;
  }
  return AppDataSource.query(
    `SELECT v.platform, v.nm_id, v.order_date,
            v.orders_count, v.avg_spp_pct, v.median_spp_pct, v.min_spp_pct, v.max_spp_pct,
            v.avg_buyer_price, v.avg_seller_price,
            COALESCE(w.product_name, v.nm_id) AS product_name
     FROM v_spp_daily v
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE s.nm_id::text = v.nm_id AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     WHERE v.order_date > (now() - make_interval(days => $1::int))::date ${platformFilter}
     ORDER BY v.order_date DESC, v.platform, v.nm_id`,
    params,
  );
}

/** Сырьё по заказам за день (для распределения/drill-down). */
export async function orderRows(platform: string, nmId: string, date: string): Promise<any[]> {
  return AppDataSource.query(
    `SELECT order_id, order_date, seller_price, buyer_price, spp_pct, region, is_cancel
     FROM spp_order
     WHERE platform = $1 AND nm_id = $2 AND order_date = $3 AND is_cancel = false
     ORDER BY spp_pct DESC NULLS LAST`,
    [platform, nmId, date],
  );
}
