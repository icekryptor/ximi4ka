/**
 * Остатки на складах WB: stocks-report (обновление у WB раз в 30 мин, лимит 3 req/min)
 * → дневной снапшот wb_stock_daily (агрегат по nm_id, склады суммируются).
 */
import { AppDataSource } from '../../config/database';
import { wbApiService } from '../wb-api.service';

export async function syncWbStocks(): Promise<{ items: number; skus: number }> {
  const items = await wbApiService.getStocksReport();
  const byNm = new Map<number, { quantity: number; toClient: number; fromClient: number }>();
  for (const it of items) {
    if (!it.nmId) continue;
    const agg = byNm.get(it.nmId) || { quantity: 0, toClient: 0, fromClient: 0 };
    agg.quantity += it.quantity || 0;
    agg.toClient += it.inWayToClient || 0;
    agg.fromClient += it.inWayFromClient || 0;
    byNm.set(it.nmId, agg);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const [nmId, a] of byNm) {
    await AppDataSource.query(
      `INSERT INTO wb_stock_daily (date, nm_id, quantity, in_way_to_client, in_way_from_client)
       VALUES ($1::date, $2, $3, $4, $5)
       ON CONFLICT (date, nm_id) DO UPDATE SET
         quantity=EXCLUDED.quantity, in_way_to_client=EXCLUDED.in_way_to_client,
         in_way_from_client=EXCLUDED.in_way_from_client, synced_at=now()`,
      [today, nmId, a.quantity, a.toClient, a.fromClient],
    );
  }
  console.log(`[wb-stocks] snapshot ${today}: items ${items.length}, skus ${byNm.size}`);
  return { items: items.length, skus: byNm.size };
}
