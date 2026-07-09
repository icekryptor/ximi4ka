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
  product_name: string | null;
  raw: unknown;
};

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

function mapWbPoint(sku: string, name: string | null, p: WbNmHistoryPoint): FunnelRow {
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
    product_name: name,
    raw: p,
  };
}

async function upsert(rows: FunnelRow[]): Promise<number> {
  const clean = rows.filter((r) => r.date && r.sku);
  for (let i = 0; i < clean.length; i += INSERT_CHUNK) {
    const chunk = clean.slice(i, i + INSERT_CHUNK);
    const cols = 18;
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((r, idx) => {
      const b = idx * cols;
      // 17 обычных плейсхолдеров + 18-й (raw) с ::jsonb
      const ph = Array.from({ length: cols - 1 }, (_, k) => `$${b + k + 1}`);
      ph.push(`$${b + cols}::jsonb`);
      values.push('(' + ph.join(',') + ')');
      params.push(
        r.platform, r.date, r.sku, r.views, r.cart, r.orders_count, r.orders_sum,
        r.buyouts_count, r.buyouts_sum, r.cancels_count, r.returns_count,
        r.cart_conv, r.order_conv, r.buyout_percent, r.avg_price, r.stock_end,
        r.product_name,
        JSON.stringify(r.raw ?? null),
      );
    });
    await AppDataSource.query(
      `INSERT INTO mp_funnel_daily
         (platform, date, sku, views, cart, orders_count, orders_sum,
          buyouts_count, buyouts_sum, cancels_count, returns_count,
          cart_conv, order_conv, buyout_percent, avg_price, stock_end, product_name, raw)
       VALUES ${values.join(',')}
       ON CONFLICT (platform, sku, date) DO UPDATE SET
         views=EXCLUDED.views, cart=EXCLUDED.cart,
         orders_count=EXCLUDED.orders_count, orders_sum=EXCLUDED.orders_sum,
         buyouts_count=EXCLUDED.buyouts_count, buyouts_sum=EXCLUDED.buyouts_sum,
         cancels_count=EXCLUDED.cancels_count, returns_count=EXCLUDED.returns_count,
         cart_conv=EXCLUDED.cart_conv, order_conv=EXCLUDED.order_conv,
         buyout_percent=EXCLUDED.buyout_percent, avg_price=EXCLUDED.avg_price,
         stock_end=EXCLUDED.stock_end,
         product_name=COALESCE(EXCLUDED.product_name, mp_funnel_daily.product_name),
         raw=EXCLUDED.raw, synced_at=now()`,
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
    product_name: (r as any).product_name ?? null,
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
    const name = it.imtName || it.vendorCode || null;
    for (const p of it.history || []) rows.push(mapWbPoint(String(it.nmID), name, p));
  }
  const upserted = rows.length ? await upsert(rows) : 0;
  console.log(`[mp-analytics] WB funnel: items ${items.length}, upserted ${upserted}`);
  return { items: items.length, upserted };
}

export interface RangeOpts {
  days?: number;
  from?: string; // YYYY-MM-DD
  to?: string;
}

const isDate = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const shift = (iso: string, deltaDays: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

/** Явный период [from,to] либо окно последних `days` дней. */
function resolveRange(opts: RangeOpts): { from: string; to: string } {
  if (isDate(opts.from) && isDate(opts.to)) {
    return opts.from <= opts.to ? { from: opts.from, to: opts.to } : { from: opts.to, to: opts.from };
  }
  const d = Math.max(1, Math.min(opts.days ?? 30, 400));
  const to = new Date().toISOString().slice(0, 10);
  return { from: shift(to, -d), to };
}

/** Дневная таймсерия (platform, период) + название товара. */
export async function dailyRows(platform: string, opts: RangeOpts = {}): Promise<any[]> {
  const { from, to } = resolveRange(opts);
  // Только нужные колонки (без raw/id/synced_at) — компактный payload.
  return AppDataSource.query(
    `SELECT platform, date, sku, views, cart, orders_count, orders_sum,
            buyouts_count, buyouts_sum, cancels_count, cart_conv, order_conv,
            buyout_percent, avg_price, stock_end,
            COALESCE(product_name, sku) AS product_name
     FROM mp_funnel_daily
     WHERE platform=$1 AND date BETWEEN $2::date AND $3::date
     ORDER BY date DESC, sku`,
    [platform, from, to],
  );
}

/** Итоги по продуктам за период + доля + сравнение с предыдущим окном той же длины. */
export async function summaryByProduct(platform: string, opts: RangeOpts = {}): Promise<any[]> {
  const { from, to } = resolveRange(opts);
  const len = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const prevTo = shift(from, -1);
  const prevFrom = shift(from, -len);
  return AppDataSource.query(
    `WITH cur AS (
       SELECT sku,
              sum(orders_sum)    AS orders_sum,
              sum(orders_count)  AS orders_count,
              sum(buyouts_sum)   AS buyouts_sum,
              sum(buyouts_count) AS buyouts_count,
              sum(views)         AS views
       FROM mp_funnel_daily
       WHERE platform=$1 AND date BETWEEN $2::date AND $3::date
       GROUP BY sku
     ),
     prev AS (
       SELECT sku, sum(orders_sum) AS orders_sum_prev
       FROM mp_funnel_daily
       WHERE platform=$1 AND date BETWEEN $4::date AND $5::date
       GROUP BY sku
     ),
     tot AS (SELECT NULLIF(sum(orders_sum),0) AS total FROM cur),
     nm AS (
       SELECT sku, max(product_name) AS product_name FROM mp_funnel_daily
       WHERE platform=$1 AND product_name IS NOT NULL GROUP BY sku
     )
     SELECT c.sku,
            COALESCE(nm.product_name, w.product_name, c.sku) AS product_name,
            c.orders_sum, c.orders_count, c.buyouts_sum, c.buyouts_count, c.views,
            round((c.orders_sum / (SELECT total FROM tot) * 100)::numeric, 1) AS share_pct,
            p.orders_sum_prev,
            round(((c.orders_sum - COALESCE(p.orders_sum_prev,0)))::numeric, 0) AS orders_sum_delta
     FROM cur c
     LEFT JOIN prev p ON p.sku = c.sku
     LEFT JOIN nm ON nm.sku = c.sku
     LEFT JOIN LATERAL (
       SELECT s.product_name FROM wb_financial_stats s
       WHERE $1='wb' AND s.nm_id::text = c.sku
         AND s.product_name IS NOT NULL AND s.product_name <> ''
       ORDER BY s.date DESC LIMIT 1
     ) w ON true
     ORDER BY c.orders_sum DESC NULLS LAST`,
    [platform, from, to, prevFrom, prevTo],
  );
}

/** Импорт дневной рекламы по источникам (au/apk/cpc) в mp_ad_daily. */
export async function importAdRows(
  platform: 'wb' | 'ozon',
  input: Array<{ date: string; sku: string; source: string } & Record<string, number | null>>,
): Promise<number> {
  const clean = input.filter((r) => r.date && r.sku && r.source);
  for (let i = 0; i < clean.length; i += INSERT_CHUNK) {
    const chunk = clean.slice(i, i + INSERT_CHUNK);
    const cols = 11;
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((r, idx) => {
      const b = idx * cols;
      values.push('(' + Array.from({ length: cols }, (_, k) => `$${b + k + 1}`).join(',') + ')');
      params.push(
        platform, String(r.date).slice(0, 10), String(r.sku), String(r.source),
        r.impressions ?? null, r.clicks ?? null, r.spend ?? null, r.carts ?? null, r.orders ?? null,
        (r as any).orders_sum ?? null, (r as any).seller_article ?? null,
      );
    });
    await AppDataSource.query(
      `INSERT INTO mp_ad_daily (platform, date, sku, source, impressions, clicks, spend, carts, orders, orders_sum, seller_article)
       VALUES ${values.join(',')}
       ON CONFLICT (platform, sku, date, source) DO UPDATE SET
         impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, spend=EXCLUDED.spend,
         carts=EXCLUDED.carts, orders=EXCLUDED.orders, orders_sum=EXCLUDED.orders_sum,
         seller_article=COALESCE(EXCLUDED.seller_article, mp_ad_daily.seller_article), synced_at=now()`,
      params,
    );
  }
  return clean.length;
}

/**
 * Отчёт по рекламе — уровень (дата, артикул): сырьё рекламы (mp_ad_daily, источники
 * au/apk/cpc суммарно) + продажи (mp_funnel_daily). Дневные строки и ДРР/CTR/ROAS
 * фронт считает из сумм. Ozon-рекламы пока нет → только WB.
 */
export async function adReport(platform: string, opts: RangeOpts = {}): Promise<any[]> {
  if (platform !== 'wb') return [];
  const { from, to } = resolveRange(opts);
  return AppDataSource.query(
    `WITH ad AS (
       SELECT date, sku,
              sum(impressions) AS impressions, sum(clicks) AS clicks,
              sum(spend) AS spend, sum(carts) AS carts_ad, sum(orders) AS orders_ad,
              sum(orders_sum) AS orders_sum_ad
       FROM mp_ad_daily
       WHERE platform='wb' AND date BETWEEN $1::date AND $2::date
       GROUP BY date, sku
     ),
     sales AS (
       SELECT date, sku, views, cart, orders_count, orders_sum,
              buyouts_count, buyouts_sum, product_name
       FROM mp_funnel_daily
       WHERE platform='wb' AND date BETWEEN $1::date AND $2::date
     ),
     names AS (
       SELECT sku, max(product_name) AS product_name FROM mp_funnel_daily
       WHERE platform='wb' AND product_name IS NOT NULL GROUP BY sku
     ),
     arts AS (
       SELECT sku, max(seller_article) AS seller_article FROM mp_ad_daily
       WHERE platform='wb' AND seller_article IS NOT NULL GROUP BY sku
     )
     SELECT COALESCE(a.date, s.date) AS date,
            COALESCE(a.sku, s.sku)   AS sku,
            COALESCE(ar.seller_article, COALESCE(a.sku, s.sku)) AS seller_article,
            COALESCE(nm.product_name, s.product_name, s.sku, a.sku) AS product_name,
            a.impressions, a.clicks, a.spend, a.carts_ad, a.orders_ad, a.orders_sum_ad,
            s.views, s.cart, s.orders_count, s.orders_sum, s.buyouts_count, s.buyouts_sum
     FROM ad a
     FULL OUTER JOIN sales s ON a.date = s.date AND a.sku = s.sku
     LEFT JOIN names nm ON nm.sku = COALESCE(a.sku, s.sku)
     LEFT JOIN arts ar ON ar.sku = COALESCE(a.sku, s.sku)
     WHERE COALESCE(a.date, s.date) BETWEEN $1::date AND $2::date
     ORDER BY date DESC, sku`,
    [from, to],
  );
}

/** Детальная реклама по (дата, артикул, источник au/apk/cpc) — для «Оцифровки продвижения». */
export async function adsDetail(platform: string, opts: RangeOpts = {}): Promise<any[]> {
  if (platform !== 'wb') return [];
  const { from, to } = resolveRange(opts);
  return AppDataSource.query(
    `SELECT ad.date, ad.sku, ad.source,
            COALESCE(ar.seller_article, ad.sku) AS seller_article,
            COALESCE(nm.product_name, ad.sku)   AS product_name,
            ad.impressions, ad.clicks, ad.spend, ad.carts, ad.orders, ad.orders_sum
     FROM mp_ad_daily ad
     LEFT JOIN (
       SELECT sku, max(seller_article) AS seller_article FROM mp_ad_daily
       WHERE platform='wb' AND seller_article IS NOT NULL GROUP BY sku
     ) ar ON ar.sku = ad.sku
     LEFT JOIN (
       SELECT sku, max(product_name) AS product_name FROM mp_funnel_daily
       WHERE platform='wb' AND product_name IS NOT NULL GROUP BY sku
     ) nm ON nm.sku = ad.sku
     WHERE ad.platform='wb' AND ad.date BETWEEN $1::date AND $2::date
     ORDER BY ad.date DESC, ad.sku, ad.source`,
    [from, to],
  );
}

/** План продвижения на месяц по артикулам: сохранённый план + маржа из актуальной юнитки (канал ВБ). */
export async function getPromoPlan(platform: string, month: string): Promise<any[]> {
  const channel = platform === 'ozon' ? 'Озон' : 'ВБ';
  return AppDataSource.query(
    `SELECT s.sku,
            s.seller_article,
            COALESCE(nm.product_name, s.sku) AS product_name,
            p.orders_sum, p.drrz,
            ue.margin
     FROM (SELECT sku, max(seller_article) AS seller_article FROM mp_ad_daily
           WHERE platform=$1 AND seller_article IS NOT NULL GROUP BY sku) s
     LEFT JOIN (SELECT sku, max(product_name) AS product_name FROM mp_funnel_daily
                WHERE platform=$1 AND product_name IS NOT NULL GROUP BY sku) nm ON nm.sku = s.sku
     LEFT JOIN promo_plan p ON p.platform=$1 AND p.sku=s.sku AND p.month=$2
     LEFT JOIN LATERAL (
       SELECT c.margin FROM sku_mappings m
       JOIN unit_economics_calculations c ON c.kit_id = m.kit_id AND c.channel_name=$3
       WHERE m.marketplace_sku = s.sku
       ORDER BY c.is_current DESC, c.updated_at DESC LIMIT 1
     ) ue ON true
     ORDER BY s.seller_article`,
    [platform, month, channel],
  );
}

/** Сохранить план по (платформа, артикул, месяц). */
export async function upsertPromoPlan(
  platform: string, sku: string, month: string,
  orders_sum: number | null, drrz: number | null,
): Promise<void> {
  await AppDataSource.query(
    `INSERT INTO promo_plan (platform, sku, month, orders_sum, drrz)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (platform, sku, month) DO UPDATE SET
       orders_sum=EXCLUDED.orders_sum, drrz=EXCLUDED.drrz, updated_at=now()`,
    [platform, sku, month, orders_sum, drrz],
  );
}

const r1 = (v: number | null): number | null => (v == null ? null : Math.round(v * 10) / 10);
const pct = (a: number, b: number): number | null => (b > 0 ? r1((a / b) * 100) : null);

/**
 * Сводка по артикулам для АГЕНТА (одним запросом): воронка + реклама + маржа из
 * актуальной юнитки + производные (ДРРз/ДРРв/ROAS/%выкупа/доля рекламы/чистая прибыль).
 * Самоописываемый ответ (fields[]) — агент читает и даёт рекомендации.
 */
export async function agentDigest(platform: string, opts: RangeOpts = {}): Promise<any> {
  const { from, to } = resolveRange(opts);
  const channel = platform === 'ozon' ? 'Озон' : 'ВБ';
  const rows: any[] = await AppDataSource.query(
    `WITH f AS (
       SELECT sku, sum(views) views, sum(cart) cart, sum(orders_count) orders_count,
              sum(orders_sum) orders_sum, sum(buyouts_count) buyouts_count, sum(buyouts_sum) buyouts_sum,
              max(product_name) product_name, sum(stock_end) stock_end
       FROM mp_funnel_daily WHERE platform=$1 AND date BETWEEN $2::date AND $3::date GROUP BY sku
     ),
     a AS (
       SELECT sku, sum(spend) spend, sum(impressions) impressions, sum(clicks) clicks,
              sum(orders) orders_ad, sum(orders_sum) orders_sum_ad, max(seller_article) seller_article
       FROM mp_ad_daily WHERE platform=$1 AND date BETWEEN $2::date AND $3::date GROUP BY sku
     )
     SELECT COALESCE(f.sku, a.sku) AS sku,
            COALESCE(a.seller_article, COALESCE(f.sku, a.sku)) AS article,
            f.product_name,
            f.views, f.cart, f.orders_count, f.orders_sum, f.buyouts_count, f.buyouts_sum, f.stock_end,
            a.spend, a.impressions, a.clicks, a.orders_ad, a.orders_sum_ad,
            ue.margin
     FROM f FULL OUTER JOIN a ON f.sku = a.sku
     LEFT JOIN LATERAL (
       SELECT c.margin FROM sku_mappings m
       JOIN unit_economics_calculations c ON c.kit_id = m.kit_id AND c.channel_name=$4
       WHERE m.marketplace_sku = COALESCE(f.sku, a.sku)
       ORDER BY c.is_current DESC, c.updated_at DESC LIMIT 1
     ) ue ON true
     ORDER BY f.orders_sum DESC NULLS LAST`,
    [platform, from, to, channel],
  );

  const items = rows.map((r) => {
    const num = (v: any) => (v == null ? 0 : Number(v));
    const orders_sum = num(r.orders_sum), buyouts_sum = num(r.buyouts_sum);
    const orders_count = num(r.orders_count), buyouts_count = num(r.buyouts_count);
    const spend = num(r.spend), orders_ad = num(r.orders_ad);
    const margin = r.margin == null ? null : Number(r.margin);
    return {
      sku: r.sku, article: r.article, product_name: r.product_name,
      views: num(r.views), cart: num(r.cart),
      orders_count, orders_sum, buyouts_count, buyouts_sum, stock_end: num(r.stock_end),
      cart_conv: pct(num(r.cart), num(r.views)),
      order_conv: pct(orders_count, num(r.cart)),
      buyout_pct: pct(buyouts_count, orders_count),
      ad_spend: spend, impressions: num(r.impressions), clicks: num(r.clicks), orders_ad,
      ad_share_orders: pct(orders_ad, orders_count),
      drrz: pct(spend, orders_sum),
      drrv: pct(spend, buyouts_sum),
      roas: spend > 0 ? r1(orders_sum / spend) : null,
      margin_pct: margin,
      est_profit: margin == null ? null : Math.round((orders_sum * margin) / 100),
    };
  });

  const sum = (k: string) => items.reduce((s, it: any) => s + (it[k] || 0), 0);
  const totals = {
    orders_sum: sum('orders_sum'), buyouts_sum: sum('buyouts_sum'),
    orders_count: sum('orders_count'), buyouts_count: sum('buyouts_count'),
    ad_spend: sum('ad_spend'), orders_ad: sum('orders_ad'),
    drrz: pct(sum('ad_spend'), sum('orders_sum')),
    drrv: pct(sum('ad_spend'), sum('buyouts_sum')),
    roas: sum('ad_spend') > 0 ? r1(sum('orders_sum') / sum('ad_spend')) : null,
    buyout_pct: pct(sum('buyouts_count'), sum('orders_count')),
    ad_share_orders: pct(sum('orders_ad'), sum('orders_count')),
    est_profit: items.reduce((s, it: any) => s + (it.est_profit || 0), 0),
  };

  return {
    platform, channel, period: { from, to },
    fields: {
      orders_sum: 'сумма заказов, ₽', buyouts_sum: 'сумма выкупов, ₽',
      buyout_pct: '% выкупа', cart_conv: 'конверсия показ→корзина, %',
      order_conv: 'конверсия корзина→заказ, %', ad_spend: 'расход на рекламу, ₽',
      ad_share_orders: 'доля заказов с рекламы, %', drrz: 'ДРР от заказов, %',
      drrv: 'ДРР от выкупов, %', roas: 'ROAS (заказы/расход)',
      margin_pct: 'маржинальность из актуальной юнитки, %',
      est_profit: 'оценка чистой прибыли (заказы×маржа), ₽',
    },
    totals,
    items,
  };
}
