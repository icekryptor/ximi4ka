/**
 * Синк финотчётов WB (reportDetailByPeriod → агрегат по (date, nm_id) → wb_financial_stats).
 * Вынесено из wb-finance.controller, чтобы дёргать и из крона, и из ручного эндпоинта.
 */
import cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { WbFinancialStat } from '../entities/WbFinancialStat';
import { wbApiService } from './wb-api.service';

const repo = () => AppDataSource.getRepository(WbFinancialStat);
const round = (v: number): number => Math.round(v * 100) / 100;

export async function syncWbFinance(startDate: string, endDate: string): Promise<{ synced: number; rawRows: number }> {
  const rows = await wbApiService.getReportDetailByPeriod(startDate, endDate);
  if (rows.length === 0) return { synced: 0, rawRows: 0 };

  const map = new Map<string, {
    date: string; nm_id: number; product_name: string;
    buyouts_sum: number; transfer_amount: number; logistics_cost: number;
    storage_cost: number; other_costs: number; acceptance_cost: number;
    returns_count: number; returns_sum: number; sales_count: number;
  }>();

  for (const row of rows) {
    const dateStr = (row.sale_dt || row.rr_dt || '').split('T')[0];
    if (!dateStr || !row.nm_id) continue;
    const key = `${dateStr}_${row.nm_id}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        date: dateStr, nm_id: row.nm_id, product_name: row.subject_name || '',
        buyouts_sum: 0, transfer_amount: 0, logistics_cost: 0, storage_cost: 0,
        other_costs: 0, acceptance_cost: 0, returns_count: 0, returns_sum: 0, sales_count: 0,
      };
      map.set(key, agg);
    }
    if (row.doc_type_name === 'Продажа') {
      agg.buyouts_sum += row.retail_amount || 0;
      agg.sales_count += row.quantity || 0;
    } else if (row.doc_type_name === 'Возврат') {
      agg.returns_count += Math.abs(row.quantity || 0);
      agg.returns_sum += Math.abs(row.retail_amount || 0);
    }
    agg.transfer_amount += row.ppvz_for_pay || 0;
    agg.logistics_cost += row.delivery_rub || 0;
    agg.storage_cost += row.storage_fee || 0;
    agg.acceptance_cost += row.acceptance || 0;
    agg.other_costs += (row.penalty || 0) + (row.additional_payment || 0)
      + (row.rebill_logistic_cost || 0) + (row.deduction || 0);
    if (!agg.product_name && row.subject_name) agg.product_name = row.subject_name;
  }

  const records = Array.from(map.values()).map((r) => ({
    ...r,
    date: new Date(r.date),
    buyouts_sum: round(r.buyouts_sum),
    transfer_amount: round(r.transfer_amount),
    logistics_cost: round(r.logistics_cost),
    storage_cost: round(r.storage_cost),
    other_costs: round(r.other_costs),
    acceptance_cost: round(r.acceptance_cost),
    returns_sum: round(r.returns_sum),
  }));

  let synced = 0;
  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await repo().createQueryBuilder().insert().into(WbFinancialStat).values(batch)
      .orUpdate(
        ['product_name', 'buyouts_sum', 'transfer_amount', 'logistics_cost', 'storage_cost',
          'other_costs', 'acceptance_cost', 'returns_count', 'returns_sum', 'sales_count', 'updated_at'],
        ['date', 'nm_id'],
      ).execute();
    synced += batch.length;
  }
  return { synced, rawRows: rows.length };
}

// Догоняющий почасовой тик: WB-лимиты на наш токен ~2 запроса/час на семейство API,
// поэтому за тик делаем максимум ОДНО 90-дневное окно (=1 запрос reportDetailByPeriod).
// Если данные свежее 3 дней — тик бесплатный (только SQL-проверка, WB не трогаем).
// Разрыв любого размера закрывается серией тиков; :20 — в стороне от крона 06:00
// (воронка+реклама), чтобы их возможный 30-мин предохранитель не накрывал нас.
const CRON_SCHEDULE = '20 * * * *';
const FRESH_DAYS = 3;   // насколько отставание считаем нормой (отчёты WB недельные)
const WINDOW_DAYS = 90; // максимум одного запроса reportDetailByPeriod
let started = false;

export function startWbFinanceScheduler(): void {
  if (started) return;
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const row = await AppDataSource.query(`SELECT max(date)::text AS maxd FROM wb_financial_stats`);
      const maxd: string | null = row?.[0]?.maxd || null;
      const freshEdge = new Date(Date.now() - FRESH_DAYS * 864e5).toISOString().slice(0, 10);
      if (maxd && maxd >= freshEdge) return; // свежо — WB не трогаем

      const startD = maxd
        ? new Date(new Date(maxd + 'T00:00:00Z').getTime() - 3 * 864e5)
        : new Date(Date.now() - 30 * 864e5);
      const start = startD.toISOString().slice(0, 10);
      const endD = new Date(startD.getTime() + (WINDOW_DAYS - 1) * 864e5);
      let end = endD.toISOString().slice(0, 10);
      if (end > today) end = today;

      const r = await syncWbFinance(start, end);
      console.log(`[wb-finance] tick (${start}→${end}): raw ${r.rawRows}, synced ${r.synced}`);
    } catch (e: any) {
      console.error('[wb-finance] tick failed (повторим через час):', e?.message || e);
    }
  });
  started = true;
  console.log(`[wb-finance] scheduler started (cron: ${CRON_SCHEDULE}, догоняющий)`);
}
