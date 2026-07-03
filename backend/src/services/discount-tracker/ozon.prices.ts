/**
 * Ozon: соинвест = marketing_seller_price - marketing_price из /product/info/prices
 * (нужны ключи продавца OZON_CLIENT_ID / OZON_API_KEY).
 * ВНИМАНИЕ по версиям API: endpoint цен эволюционирует (v4/v5) —
 * при 404 сверить OZON_PRICES_URL и имена полей с актуальной документацией.
 */

import { Snapshot } from './wb.prices';

const DEFAULT_OZON_PRICES_URL = 'https://api-seller.ozon.ru/v5/product/info/prices';

export async function fetchOzon(): Promise<Snapshot[]> {
  const clientId = process.env.OZON_CLIENT_ID;
  const apiKey = process.env.OZON_API_KEY;
  if (!clientId || !apiKey) {
    console.log('[discount-tracker] ozon keys missing, skip');
    return [];
  }
  const url = process.env.OZON_PRICES_URL || DEFAULT_OZON_PRICES_URL;

  const out: Snapshot[] = [];
  let cursor = '';
  do {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-Id': clientId,
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor, limit: 1000, filter: { visibility: 'ALL' } }),
    });
    if (!r.ok) {
      if (r.status === 404) {
        console.error(
          '[discount-tracker] Ozon prices API 404 — проверь версию endpoint (v4/v5) в OZON_PRICES_URL:',
          url,
          await r.text(),
        );
      } else {
        console.error('[discount-tracker] Ozon prices API', r.status, await r.text());
      }
      break;
    }
    const j: any = await r.json();
    for (const it of j?.items ?? []) {
      const pr = it?.price ?? {};
      const seller = Number(pr.price); // ваша цена = база комиссии
      const afterOwn = Number(pr.marketing_seller_price || pr.price); // после ваших акций
      const shelf = Number(pr.marketing_price || afterOwn); // витрина, вкл. соинвест площадки
      if (!seller) continue;
      const ownDisc = Math.max(seller - afterOwn, 0); // ваша скидка
      const platformDisc = Math.max(afterOwn - shelf, 0); // доля площадки на витрине (соинвест)
      out.push({
        platform: 'ozon',
        sku: String(it.offer_id ?? it.product_id),
        seller_price: seller,
        shelf_price: shelf,
        own_discount: ownDisc,
        platform_disc: platformDisc,
        discount_pct: 1 - shelf / seller,
        platform_pct: seller ? platformDisc / seller : 0,
        raw: pr,
      });
    }
    cursor = j?.cursor ?? '';
  } while (cursor);
  return out;
}
