/**
 * «Финансовые показатели недели» — сводка за неделю (пн–вс) из трёх источников:
 * финотчёт (wb_financial_stats), воронка (mp_funnel_daily), реклама (mp_ad_daily),
 * плюс COGS из себестоимости наборов (sku_mappings → kits).
 */
import { AppDataSource } from '../config/database';

const TAX_RATE = 0.08;          // УСН доходы 8% — база: сумма выкупов
const COMMISSION_RATE = 0.355;  // комиссия ВБ — константа 35,5% от выкупов (по бизнес-правилу)

const num = (v: unknown): number => (v == null ? 0 : Number(v)) || 0;
const r2 = (v: number): number => Math.round(v * 100) / 100;

export interface WeeklyFinance {
  week: { start: string; end: string };
  sources: { finance: boolean; funnel: boolean; ads: boolean };
  metrics: {
    orders_sum: number;        // сумма заказов (воронка)
    buyouts_sum: number;       // сумма выкупов (финотчёт; фолбэк — воронка)
    transfer_amount: number;   // к перечислению за товар
    logistics_cost: number;
    storage_cost: number;
    other_costs: number;       // приёмка + штрафы + прочие удержания
    ad_spend: number;          // рекламный бюджет
    commission: number;        // комиссия ВБ = 35,5% × выкупы (константа)
    commission_rate: number;
    payout_total: number;      // итого к оплате = к перечислению − логистика − хранение − прочие − реклама
    transfer_estimated: boolean; // нет финотчёта: перечисление/итого — оценка через константу комиссии
  };
  profit: {
    cogs: number;              // Σ себестоимость набора × продано шт
    tax_rate: number;
    tax: number;               // 8% × выкупы
    net_profit: number;        // итого к оплате − COGS − налог
    cogs_detail: Array<{ sku: string; kit: string | null; qty: number; unit_cost: number | null; total: number | null }>;
  };
}

export async function weeklyFinance(weekStart: string): Promise<WeeklyFinance> {
  const start = weekStart;
  const endD = new Date(weekStart + 'T00:00:00Z');
  endD.setUTCDate(endD.getUTCDate() + 6);
  const end = endD.toISOString().slice(0, 10);

  const [fin] = await AppDataSource.query(
    `SELECT count(*)::int rows, sum(buyouts_sum) buyouts, sum(transfer_amount) transfer,
            sum(logistics_cost) logistics, sum(storage_cost) storage,
            sum(other_costs) + sum(acceptance_cost) other
     FROM wb_financial_stats WHERE date BETWEEN $1::date AND $2::date`,
    [start, end],
  );
  const [fun] = await AppDataSource.query(
    `SELECT count(*)::int rows, sum(orders_sum) orders_sum, sum(buyouts_sum) buyouts
     FROM mp_funnel_daily WHERE platform='wb' AND date BETWEEN $1::date AND $2::date`,
    [start, end],
  );
  const [ads] = await AppDataSource.query(
    `SELECT count(*)::int rows, sum(spend) spend
     FROM mp_ad_daily WHERE platform='wb' AND date BETWEEN $1::date AND $2::date`,
    [start, end],
  );

  const hasFinance = num(fin?.rows) > 0;
  // COGS: продано шт — из финотчёта (sales_count), при его отсутствии из воронки (buyouts_count)
  const cogsRows: any[] = await AppDataSource.query(
    hasFinance
      ? `SELECT s.nm_id::text sku, sum(s.sales_count)::int qty,
                k.sku kit, COALESCE(NULLIF(k.total_cost,0), k.estimated_cost) unit_cost
         FROM wb_financial_stats s
         LEFT JOIN sku_mappings m ON m.marketplace_sku = s.nm_id::text
         LEFT JOIN kits k ON k.id = m.kit_id
         WHERE s.date BETWEEN $1::date AND $2::date
         GROUP BY s.nm_id, k.sku, unit_cost HAVING sum(s.sales_count) > 0`
      : `SELECT f.sku, sum(f.buyouts_count)::int qty,
                k.sku kit, COALESCE(NULLIF(k.total_cost,0), k.estimated_cost) unit_cost
         FROM mp_funnel_daily f
         LEFT JOIN sku_mappings m ON m.marketplace_sku = f.sku
         LEFT JOIN kits k ON k.id = m.kit_id
         WHERE f.platform='wb' AND f.date BETWEEN $1::date AND $2::date
         GROUP BY f.sku, k.sku, unit_cost HAVING sum(f.buyouts_count) > 0`,
    [start, end],
  );

  const buyouts = hasFinance ? num(fin.buyouts) : num(fun?.buyouts);
  const logistics = num(fin?.logistics);
  const storage = num(fin?.storage);
  const other = num(fin?.other);
  const adSpend = num(ads?.spend);
  // Комиссия — бизнес-константа 35,5% от выкупов (факт «выкупы − перечисление»
  // прыгает из-за компенсаций WB, вплоть до отрицательных значений).
  const commission = r2(buyouts * COMMISSION_RATE);
  // Перечисление: факт из финотчёта; без него — оценка через константу комиссии.
  const transfer = hasFinance ? num(fin.transfer) : r2(buyouts - commission);
  const payoutTotal = r2(transfer - logistics - storage - other - adSpend);

  const cogsDetail = cogsRows.map((r) => ({
    sku: String(r.sku),
    kit: r.kit ?? null,
    qty: num(r.qty),
    unit_cost: r.unit_cost == null ? null : num(r.unit_cost),
    total: r.unit_cost == null ? null : r2(num(r.unit_cost) * num(r.qty)),
  }));
  const cogs = r2(cogsDetail.reduce((s, d) => s + (d.total || 0), 0));
  const tax = r2(buyouts * TAX_RATE);
  const netProfit = r2(payoutTotal - cogs - tax);

  return {
    week: { start, end },
    sources: { finance: hasFinance, funnel: num(fun?.rows) > 0, ads: num(ads?.rows) > 0 },
    metrics: {
      orders_sum: r2(num(fun?.orders_sum)),
      buyouts_sum: r2(buyouts),
      transfer_amount: r2(transfer),
      logistics_cost: r2(logistics),
      storage_cost: r2(storage),
      other_costs: r2(other),
      ad_spend: r2(adSpend),
      commission,
      commission_rate: COMMISSION_RATE,
      payout_total: payoutTotal,
      transfer_estimated: !hasFinance,
    },
    profit: { cogs, tax_rate: TAX_RATE, tax, net_profit: netProfit, cogs_detail: cogsDetail },
  };
}
