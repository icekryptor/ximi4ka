/**
 * WB: две цены из двух источников (card.wb.ru v2 умер — 404/403 с 2026-07).
 *
 * 1) Цена продавца (после своей скидки, ДО СПП) — seller API «Цены и скидки»:
 *    GET discounts-prices-api.wildberries.ru/api/v2/list/goods/filter
 *    (Bearer WB_API_TOKEN — тот же, что у wb-finance/wb-ads синков; нужен скоуп «Цены и скидки»)
 * 2) Витрина (с СПП, что видит покупатель) — публичный card.wb.ru/cards/v4/detail,
 *    поле sizes[0].price.product (копейки), батчи по 100, браузерный UA против WAF.
 *
 * СПП = 1 − shelf/seller.
 */

export type Snapshot = {
  platform: 'wb' | 'ozon';
  sku: string;
  seller_price: number;
  shelf_price: number;
  own_discount: number | null;
  platform_disc: number;
  discount_pct: number;
  platform_pct: number;
  raw: unknown;
};

const WB_CARD_URL = 'https://card.wb.ru/cards/v4/detail';
const WB_PRICES_URL = 'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter';

// WAF WB банит витрину card.wb.ru по TLS-фингерпринту Node/undici + датацентровому IP.
// CONNECT-прокси не помогает (TLS терминируется на клиенте). Решение — HTTP-релей
// на РФ-VPS: он сам curl'ит WB (проходит WAF) и отдаёт JSON. Railway ходит к релею.
// WB_CARD_RELAY_URL=http://host:port (эндпоинт /cards?nm=), WB_RELAY_TOKEN — авторизация.
const RELAY_URL = process.env.WB_CARD_RELAY_URL;
const RELAY_TOKEN = process.env.WB_RELAY_TOKEN || '';
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'ru-RU,ru;q=0.9',
  Origin: 'https://www.wildberries.ru',
  Referer: 'https://www.wildberries.ru/',
};

// Транзиентные статусы seller-API (рейт-лимит / сбой шлюза) — их ретраим.
// 401/403/404 не ретраим: это конфиг (скоуп токена), повтор не поможет.
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/** fetch с ретраем на транзиентных ошибках; уважает Retry-After, экспоненциальный бэкофф. */
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const r = await fetch(url, init);
      if (r.ok || !RETRYABLE.has(r.status)) return r; // успех или нератраибл (401/403/404)
      last = r;
    } catch (e) {
      if (attempt === tries) throw e; // сетевой сбой — исчерпали попытки
    }
    if (attempt === tries) break;
    const ra = Number(last?.headers.get('retry-after'));
    const waitMs = ra > 0 ? Math.min(ra * 1000, 10_000) : 1_500 * attempt;
    await new Promise(res => setTimeout(res, waitMs));
  }
  return last as Response;
}

/**
 * Цены продавца из seller API: nmID → { seller (после скидки), base (до скидки) }.
 * ok=false, если свод не удалось получить (пустой токен / не-OK ответ) — тогда caller
 * пропускает SKU без цены продавца, а НЕ пишет ложный 0% СПП (seller=витрина).
 */
async function fetchSellerPrices(): Promise<{
  prices: Map<number, { seller: number; base: number }>;
  ok: boolean;
}> {
  const map = new Map<number, { seller: number; base: number }>();
  const token = process.env.WB_API_TOKEN;
  if (!token) {
    console.warn('[discount-tracker] WB_API_TOKEN не задан — цены продавца недоступны');
    return { prices: map, ok: false };
  }
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const r = await fetchRetry(`${WB_PRICES_URL}?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: token },
    });
    if (!r.ok) {
      console.error(
        `[discount-tracker] WB discounts-prices API ${r.status}` +
          (r.status === 401 || r.status === 403
            ? ' — проверь скоуп «Цены и скидки» у WB_API_TOKEN'
            : ' — вероятно рейт-лимит; SKU без цены продавца будут пропущены'),
      );
      return { prices: map, ok: false };
    }
    const j: any = await r.json();
    const goods: any[] = j?.data?.listGoods ?? [];
    for (const g of goods) {
      const size = g?.sizes?.[0];
      if (!size) continue;
      const seller = Number(size.discountedPrice ?? size.price);
      const base = Number(size.price);
      if (g.nmID && seller) map.set(Number(g.nmID), { seller, base });
    }
    if (goods.length < limit) break;
    offset += limit;
  }
  return { prices: map, ok: true };
}

export async function fetchWb(nmIds: number[]): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  if (!nmIds.length) return out;

  const { prices: sellerPrices, ok: sellerOk } = await fetchSellerPrices();
  let skipped = 0;

  for (let i = 0; i < nmIds.length; i += 100) {
    const batch = nmIds.slice(i, i + 100);
    const nm = batch.join(';');
    // Через релей (обход WAF) либо напрямую (локальная разработка с РФ IP)
    const url = RELAY_URL
      ? `${RELAY_URL.replace(/\/$/, '')}/cards?nm=${encodeURIComponent(nm)}`
      : `${WB_CARD_URL}?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nm}`;
    const headers: Record<string, string> = RELAY_URL
      ? { 'X-Relay-Token': RELAY_TOKEN }
      : BROWSER_HEADERS;
    const r = await fetchRetry(url, { headers });
    if (!r.ok) {
      const body = (await r.text().catch(() => '')).slice(0, 200);
      console.error(
        `[discount-tracker] WB card ${r.status}` +
          (RELAY_URL ? ' (через релей)' : ' (напрямую — WAF банит датацентры, задай WB_CARD_RELAY_URL)') +
          ` body=${body}`,
      );
      continue;
    }
    const j: any = await r.json();
    // v4: products на верхнем уровне; price.product — витрина с СПП (копейки)
    for (const p of j?.products ?? j?.data?.products ?? []) {
      const price = p?.sizes?.[0]?.price;
      if (!price?.product) continue;
      const shelf = price.product / 100;
      const sp = sellerPrices.get(Number(p.id));
      // Нет цены продавца → СПП посчитать нельзя. Раньше фолбэчили seller=витрина и
      // писали ложный 0% (портит хитмап + может дёрнуть ложный алерт «СПП обвалилась»).
      // Теперь пропускаем SKU — лучше пропуск, чем неверные данные.
      if (!sp?.seller) {
        skipped++;
        continue;
      }
      const seller = sp.seller;
      const platformDisc = Math.max(seller - shelf, 0);
      out.push({
        platform: 'wb',
        sku: String(p.id),
        seller_price: seller,
        shelf_price: shelf,
        own_discount: Math.max(sp.base - sp.seller, 0),
        platform_disc: platformDisc,
        discount_pct: 1 - shelf / seller,
        platform_pct: platformDisc / seller,
        raw: { card: price, sellerApi: sp },
      });
    }
  }
  if (skipped) {
    console.warn(
      `[discount-tracker] WB: ${skipped} SKU без цены продавца` +
        (sellerOk ? '' : ' (seller API недоступен — рейт-лимит?)') +
        ' — пропущены, чтобы не писать ложный 0% СПП',
    );
  }
  return out;
}
