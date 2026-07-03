/**
 * СПП / Соинвест tracker — оркестрация одного прохода:
 * nmIds из wb_financial_stats (90 дней) → fetchWb + fetchOzon →
 * batch insert в price_snapshots → Telegram-алерты при просадке доли площадки.
 */

import { AppDataSource } from '../../config/database';
import { AlertState } from '../../entities/AlertState';
import { sendMessage } from '../telegram.service';
import { fetchWb, Snapshot } from './wb.prices';
import { fetchOzon } from './ozon.prices';

const INSERT_CHUNK = 500;

function alertDrop(): number {
  return Number(process.env.ALERT_DROP_PP || '5') / 100;
}

/** Batch insert снапшотов сырым SQL — в БД id bigint generated always as identity */
async function insertSnapshots(snaps: Snapshot[]): Promise<void> {
  for (let i = 0; i < snaps.length; i += INSERT_CHUNK) {
    const chunk = snaps.slice(i, i + INSERT_CHUNK);
    const values: string[] = [];
    const params: unknown[] = [];
    chunk.forEach((s, idx) => {
      const base = idx * 9;
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}::jsonb)`,
      );
      params.push(
        s.platform,
        s.sku,
        s.seller_price,
        s.shelf_price,
        s.own_discount,
        s.platform_disc,
        s.discount_pct,
        s.platform_pct,
        JSON.stringify(s.raw ?? null),
      );
    });
    await AppDataSource.query(
      `INSERT INTO price_snapshots
         (platform, sku, seller_price, shelf_price, own_discount, platform_disc, discount_pct, platform_pct, raw)
       VALUES ${values.join(', ')}`,
      params,
    );
  }
}

/** Алерт при просадке доли площадки >= ALERT_DROP_PP п.п.; upsert alert_state */
async function maybeAlert(snap: Snapshot): Promise<boolean> {
  const chatId = process.env.SPP_ALERT_CHAT_ID;

  const repo = AppDataSource.getRepository(AlertState);
  const prev = await repo.findOne({ where: { platform: snap.platform, sku: snap.sku } });

  const last = prev?.last_pct != null ? Number(prev.last_pct) : null;
  const dropped = last != null && last - snap.platform_pct >= alertDrop();

  if (dropped && chatId) {
    const msg =
      `⚠️ ${snap.platform.toUpperCase()} ${snap.sku}\n` +
      `Субсидия площадки: ${(last! * 100).toFixed(1)}% → ${(snap.platform_pct * 100).toFixed(1)}%\n` +
      `Витрина: ${snap.shelf_price}₽ (цена продавца ${snap.seller_price}₽)`;
    await sendMessage(chatId, msg);
  }

  await AppDataSource.query(
    `INSERT INTO alert_state (platform, sku, last_pct, last_alerted)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (platform, sku) DO UPDATE
       SET last_pct = EXCLUDED.last_pct,
           last_alerted = COALESCE(EXCLUDED.last_alerted, alert_state.last_alerted)`,
    [snap.platform, snap.sku, snap.platform_pct, dropped ? new Date() : null],
  );

  return dropped && !!chatId;
}

export async function runOnce(): Promise<{ snapshots: number; alerts: number }> {
  let rows: Array<{ nm_id: string }> = await AppDataSource.query(
    `SELECT DISTINCT nm_id FROM wb_financial_stats WHERE date > now() - interval '90 days'`,
  );
  if (!rows.length) {
    // Финстат мог давно не синкаться — лучше отслеживать все известные артикулы, чем ни одного
    rows = await AppDataSource.query(`SELECT DISTINCT nm_id FROM wb_financial_stats`);
    if (rows.length) console.log(`[discount-tracker] 90-day window empty, fallback to all-time nmIds (${rows.length})`);
  }
  const nmIds = rows.map(r => Number(r.nm_id)).filter(Boolean);

  const snaps = [...(await fetchWb(nmIds)), ...(await fetchOzon())];
  if (!snaps.length) {
    console.log('[discount-tracker] no snapshots');
    return { snapshots: 0, alerts: 0 };
  }

  await insertSnapshots(snaps);

  let alerts = 0;
  for (const s of snaps) {
    if (await maybeAlert(s)) alerts++;
  }

  console.log(`[discount-tracker] saved ${snaps.length} snapshots, ${alerts} alerts @ ${new Date().toISOString()}`);
  return { snapshots: snaps.length, alerts };
}
