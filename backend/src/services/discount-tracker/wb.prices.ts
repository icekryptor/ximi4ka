/**
 * WB: снятие цен через публичный card.wb.ru (без авторизации).
 * СПП = 1 - total/product; батчим nmIds по 100 в один запрос (nm=1;2;3).
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

const WB_CARD_URL = 'https://card.wb.ru/cards/v2/detail';

export async function fetchWb(nmIds: number[]): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  for (let i = 0; i < nmIds.length; i += 100) {
    const batch = nmIds.slice(i, i + 100);
    const url =
      `${WB_CARD_URL}?appType=1&curr=rub&dest=-1257786&spp=30&nm=` +
      batch.join(';');
    const r = await fetch(url);
    if (!r.ok) {
      console.error('[discount-tracker] WB card API', r.status);
      continue;
    }
    const j: any = await r.json();
    for (const p of j?.data?.products ?? []) {
      const price = p?.sizes?.[0]?.price;
      if (!price?.product || !price?.total) continue;
      const seller = price.product / 100; // цена продавца (после своей скидки, до СПП)
      const shelf = price.total / 100; // витрина (с СПП)
      const platformDisc = Math.max(seller - shelf, 0); // рубли СПП
      out.push({
        platform: 'wb',
        sku: String(p.id),
        seller_price: seller,
        shelf_price: shelf,
        own_discount: null, // WB не разводит своё/чужое в публичном API
        platform_disc: platformDisc,
        discount_pct: 1 - shelf / seller,
        platform_pct: seller ? platformDisc / seller : 0,
        raw: price,
      });
    }
  }
  return out;
}
