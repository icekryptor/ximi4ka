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
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
};

/** Цены продавца из seller API: nmID → { seller (после скидки), base (до скидки) } */
async function fetchSellerPrices(): Promise<Map<number, { seller: number; base: number }>> {
  const map = new Map<number, { seller: number; base: number }>();
  const token = process.env.WB_API_TOKEN;
  if (!token) {
    console.warn('[discount-tracker] WB_API_TOKEN не задан — цены продавца недоступны');
    return map;
  }
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const r = await fetch(`${WB_PRICES_URL}?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: token },
    });
    if (!r.ok) {
      console.error(
        `[discount-tracker] WB discounts-prices API ${r.status}` +
          (r.status === 401 || r.status === 403
            ? ' — проверь скоуп «Цены и скидки» у WB_API_TOKEN'
            : ''),
      );
      break;
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
  return map;
}

export async function fetchWb(nmIds: number[]): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  if (!nmIds.length) return out;

  const sellerPrices = await fetchSellerPrices();

  for (let i = 0; i < nmIds.length; i += 100) {
    const batch = nmIds.slice(i, i + 100);
    const url = `${WB_CARD_URL}?appType=1&curr=rub&dest=-1257786&spp=30&nm=` + batch.join(';');
    const r = await fetch(url, { headers: BROWSER_HEADERS });
    if (!r.ok) {
      console.error('[discount-tracker] WB card API', r.status);
      continue;
    }
    const j: any = await r.json();
    // v4: products на верхнем уровне; price.product — витрина с СПП (копейки)
    for (const p of j?.products ?? j?.data?.products ?? []) {
      const price = p?.sizes?.[0]?.price;
      if (!price?.product) continue;
      const shelf = price.product / 100;
      const sp = sellerPrices.get(Number(p.id));
      // Без seller API берём витрину и как цену продавца (СПП = 0) — снапшот всё равно ценен
      const seller = sp?.seller ?? shelf;
      const platformDisc = Math.max(seller - shelf, 0);
      out.push({
        platform: 'wb',
        sku: String(p.id),
        seller_price: seller,
        shelf_price: shelf,
        own_discount: sp ? Math.max(sp.base - sp.seller, 0) : null,
        platform_disc: platformDisc,
        discount_pct: seller ? 1 - shelf / seller : 0,
        platform_pct: seller ? platformDisc / seller : 0,
        raw: { card: price, sellerApi: sp ?? null },
      });
    }
  }
  return out;
}
