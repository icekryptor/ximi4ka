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

/** Нормализованная строка отчёта реализации (v1 camelCase / v5 snake_case → общая форма). */
interface NormRow {
  date: string; nmId: number; subject: string; docType: string; qty: number;
  retail: number; forPay: number; logistics: number; storage: number;
  acceptance: number; acquiring: number; commissionFact: number; other: number;
}

const s2n = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Тянем отчёт: сначала finance-api v1 (WB удаляет v5 15.07.2026), при ошибке —
 * фолбэк на statistics v5 (жив до 15.07). Обе ветки собирают эквайринг и факт-комиссию.
 */
async function fetchReportNormalized(startDate: string, endDate: string): Promise<{ rows: NormRow[]; source: string }> {
  try {
    const v1 = await wbApiService.getSalesReportDetailedV1(startDate, endDate);
    const mapped: NormRow[] = v1.map((r) => ({
        date: (r.saleDt || r.rrDate || '').split('T')[0],
        nmId: r.nmId || 0,
        subject: r.subjectName || '',
        docType: r.docTypeName || '',
        qty: s2n(r.quantity),
        retail: s2n(r.retailAmount),
        forPay: s2n(r.forPay),
        logistics: s2n(r.deliveryService),
        storage: s2n(r.paidStorage),
        acceptance: s2n(r.paidAcceptance),
        acquiring: s2n(r.acquiringFee),
        commissionFact: s2n(r.ppvzSalesCommission),
        other: s2n(r.penalty) + s2n(r.additionalPayment) + s2n(r.rebillLogisticCost) + s2n(r.deduction),
      }));
    // Sanity-гейт: схема v1 предположена по спеке и вживую не подтверждена.
    // Если строки есть, но денег ноль или нет ни одной продажи/возврата — имена
    // полей не совпали; кидаем ошибку (фолбэк/повтор через час), историю НЕ пишем.
    if (mapped.length > 0) {
      const money = mapped.reduce((s, r) => s + Math.abs(r.retail) + Math.abs(r.forPay) + Math.abs(r.logistics) + Math.abs(r.storage), 0);
      const hasSales = mapped.some((r) => r.docType === 'Продажа' || r.docType === 'Возврат');
      if (money === 0 || (!hasSales && mapped.length > 10)) {
        console.error('[wb-finance] v1 sanity-check провален; ключи первой строки:', Object.keys((v1[0] as any) ?? {}));
        throw new Error(`v1 схема не совпала (деньги=${money}, продажи=${hasSales}) — не пишем`);
      }
    }
    return { source: 'finance-v1', rows: mapped };
  } catch (e: any) {
    console.warn('[wb-finance] finance-api v1 недоступен, фолбэк на v5:', e?.message || e);
    const v5 = await wbApiService.getReportDetailByPeriod(startDate, endDate);
    return {
      source: 'statistics-v5',
      rows: v5.map((r: any) => ({
        date: (r.sale_dt || r.rr_dt || '').split('T')[0],
        nmId: r.nm_id || 0,
        subject: r.subject_name || '',
        docType: r.doc_type_name || '',
        qty: s2n(r.quantity),
        retail: s2n(r.retail_amount),
        forPay: s2n(r.ppvz_for_pay),
        logistics: s2n(r.delivery_rub),
        storage: s2n(r.storage_fee),
        acceptance: s2n(r.acceptance),
        acquiring: s2n(r.acquiring_fee),
        commissionFact: s2n(r.ppvz_sales_commission),
        other: s2n(r.penalty) + s2n(r.additional_payment) + s2n(r.rebill_logistic_cost) + s2n(r.deduction),
      })),
    };
  }
}

export async function syncWbFinance(startDate: string, endDate: string): Promise<{ synced: number; rawRows: number; source: string }> {
  const { rows, source } = await fetchReportNormalized(startDate, endDate);
  if (rows.length === 0) return { synced: 0, rawRows: 0, source };

  const map = new Map<string, {
    date: string; nm_id: number; product_name: string;
    buyouts_sum: number; transfer_amount: number; logistics_cost: number;
    storage_cost: number; other_costs: number; acceptance_cost: number;
    acquiring_cost: number; commission_fact: number;
    returns_count: number; returns_sum: number; sales_count: number;
  }>();

  for (const row of rows) {
    if (!row.date) continue;
    // Услуги без привязки к товару (хранение, штрафы, удержания) приходят
    // строками с пустым nm_id — агрегируем их в nm_id=0 «Прочее (без артикула)»,
    // иначе хранение теряется целиком.
    const key = `${row.date}_${row.nmId}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        date: row.date, nm_id: row.nmId,
        product_name: row.nmId === 0 ? 'Прочее (без артикула)' : row.subject,
        buyouts_sum: 0, transfer_amount: 0, logistics_cost: 0, storage_cost: 0,
        other_costs: 0, acceptance_cost: 0, acquiring_cost: 0, commission_fact: 0,
        returns_count: 0, returns_sum: 0, sales_count: 0,
      };
      map.set(key, agg);
    }
    if (row.docType === 'Продажа') {
      agg.buyouts_sum += row.retail;
      agg.sales_count += row.qty;
    } else if (row.docType === 'Возврат') {
      agg.returns_count += Math.abs(row.qty);
      agg.returns_sum += Math.abs(row.retail);
    }
    agg.transfer_amount += row.forPay;
    agg.logistics_cost += row.logistics;
    agg.storage_cost += row.storage;
    agg.acceptance_cost += row.acceptance;
    agg.acquiring_cost += row.acquiring;
    agg.commission_fact += row.commissionFact;
    agg.other_costs += row.other;
    if (!agg.product_name && row.subject) agg.product_name = row.subject;
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
    acquiring_cost: round(r.acquiring_cost),
    commission_fact: round(r.commission_fact),
    returns_sum: round(r.returns_sum),
  }));

  let synced = 0;
  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await repo().createQueryBuilder().insert().into(WbFinancialStat).values(batch)
      .orUpdate(
        ['product_name', 'buyouts_sum', 'transfer_amount', 'logistics_cost', 'storage_cost',
          'other_costs', 'acceptance_cost', 'acquiring_cost', 'commission_fact', 'returns_count', 'returns_sum', 'sales_count', 'updated_at'],
        ['date', 'nm_id'],
      ).execute();
    synced += batch.length;
  }
  return { synced, rawRows: rows.length, source };
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

      let start: string;
      let end: string;
      let isReread = false;
      if (!maxd || maxd < freshEdge) {
        // отстаём — догоняем вперёд от последней даты
        const startD = maxd
          ? new Date(new Date(maxd + 'T00:00:00Z').getTime() - 3 * 864e5)
          : new Date(Date.now() - 30 * 864e5);
        start = startD.toISOString().slice(0, 10);
        const endD = new Date(startD.getTime() + (WINDOW_DAYS - 1) * 864e5);
        end = endD.toISOString().slice(0, 10);
        if (end > today) end = today;
      } else {
        // свежо — перечитываем историю, где эквайринг ещё не собран старым парсером
        // (acquiring_cost IS NULL = маркер; новый парсер всегда пишет число)
        const gap = await AppDataSource.query(
          `SELECT min(date)::text AS mind FROM wb_financial_stats WHERE acquiring_cost IS NULL`,
        );
        const mind: string | null = gap?.[0]?.mind || null;
        if (!mind) return; // всё перечитано — WB не трогаем
        isReread = true;
        start = mind;
        const endD = new Date(new Date(mind + 'T00:00:00Z').getTime() + (WINDOW_DAYS - 1) * 864e5);
        end = endD.toISOString().slice(0, 10);
        if (end > today) end = today;
      }

      const r = await syncWbFinance(start, end);
      if (isReread) {
        // Терминальность окна: ключи, не пришедшие в свежем ответе (иная атрибуция
        // услуг у v1), закрываем нулём — иначе min(date) замирает и перечитка
        // зацикливается, сжигая бюджет WB каждый час. Деньги старого парсера не трогаем.
        await AppDataSource.query(
          `UPDATE wb_financial_stats SET acquiring_cost = 0
           WHERE acquiring_cost IS NULL AND date BETWEEN $1::date AND $2::date`,
          [start, end],
        );
        console.log(`[wb-finance] окно перечитки закрыто (${start}→${end})`);
      }
      console.log(`[wb-finance] tick (${start}→${end}, ${r.source}): raw ${r.rawRows}, synced ${r.synced}`);
    } catch (e: any) {
      console.error('[wb-finance] tick failed (повторим через час):', e?.message || e);
    }
  });
  started = true;
  console.log(`[wb-finance] scheduler started (cron: ${CRON_SCHEDULE}, догоняющий)`);
}
