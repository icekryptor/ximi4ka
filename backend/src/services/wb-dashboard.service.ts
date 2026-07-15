/**
 * Дашборд WB (главная): график выручки по дням + метрики-чипы с дельтой к прошлому
 * периоду. Каждая метрика самоописываемая: formula + sources — фронт показывает их
 * в детализации по клику. Источники: mp_funnel_daily (воронка), wb_financial_stats
 * (финотчёт), mp_ad_daily (реклама), spp_order (цены), wb_stock_daily (остатки),
 * kits+sku_mappings (себестоимость), transactions (опер. расходы).
 */
import { AppDataSource } from '../config/database';

const TAX_RATE = 0.08;          // УСН доходы, база — выкупы
const COMMISSION_RATE = 0.355;  // комиссия ВБ — бизнес-константа

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (v: number): number => Math.round(v * 100) / 100;
const pct = (a: number, b: number): number | null => (b > 0 ? r2((a / b) * 100) : null);

export interface DashMetric {
  key: string;
  label: string;
  value: number | null;
  unit: 'rub' | 'pct' | 'pcs' | 'x';
  /** второе значение (например шт при ₽) */
  sub?: { value: number; unit: 'rub' | 'pct' | 'pcs' } | null;
  prev: number | null;
  deltaPct: number | null;
  /** какая динамика «хорошая»: рост или падение (для окраски) */
  goodWhen: 'up' | 'down';
  formula: string;
  sources: string[];
  /** серия по дням для мини-графика в детализации */
  series?: Array<{ date: string; value: number }>;
  note?: string;
}

interface Range { from: string; to: string }

function prevRange(r: Range): Range {
  const from = new Date(r.from + 'T00:00:00Z');
  const to = new Date(r.to + 'T00:00:00Z');
  const days = Math.round((to.getTime() - from.getTime()) / 864e5) + 1;
  const pf = new Date(from.getTime() - days * 864e5);
  const pt = new Date(from.getTime() - 864e5);
  return { from: pf.toISOString().slice(0, 10), to: pt.toISOString().slice(0, 10) };
}

/** Сырьё одного периода — все агрегаты одним батчем запросов. */
async function periodRaw(r: Range) {
  const [funnel, fin, ads, spp, opex, cogsRows] = await Promise.all([
    AppDataSource.query(
      `SELECT sum(orders_sum) orders_sum, sum(orders_count) orders_count,
              sum(buyouts_sum) buyouts_sum, sum(buyouts_count) buyouts_count
       FROM mp_funnel_daily WHERE platform='wb' AND date BETWEEN $1::date AND $2::date`, [r.from, r.to]),
    AppDataSource.query(
      `SELECT count(*)::int rows, sum(buyouts_sum) buyouts, sum(transfer_amount) transfer,
              sum(logistics_cost) logistics, sum(storage_cost) storage,
              sum(acceptance_cost) acceptance, sum(other_costs) other,
              sum(acquiring_cost) acquiring, sum(commission_fact) commission_fact,
              sum(sales_count) sales_count, sum(returns_sum) returns_sum,
              sum(returns_count) returns_count, max(date)::text fin_to
       FROM wb_financial_stats WHERE date BETWEEN $1::date AND $2::date`, [r.from, r.to]),
    AppDataSource.query(
      `SELECT sum(spend) spend FROM mp_ad_daily
       WHERE platform='wb' AND date BETWEEN $1::date AND $2::date`, [r.from, r.to]),
    AppDataSource.query(
      `SELECT avg(seller_price) avg_seller_price FROM spp_order
       WHERE is_cancel = false AND order_date::date BETWEEN $1::date AND $2::date`, [r.from, r.to]),
    AppDataSource.query(
      `SELECT COALESCE(sum(t.amount), 0) expense FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.type = 'expense' AND t.date BETWEEN $1::date AND $2::date`, [r.from, r.to]),
    AppDataSource.query(
      `SELECT COALESCE(sum((s.sales_count - s.returns_count) * COALESCE(NULLIF(k.total_cost,0), k.estimated_cost)), 0) cogs,
              COALESCE(sum(s.sales_count - s.returns_count)
                FILTER (WHERE k.id IS NULL OR COALESCE(NULLIF(k.total_cost,0), k.estimated_cost) IS NULL), 0)::int unmapped_qty
       FROM wb_financial_stats s
       LEFT JOIN sku_mappings m ON m.marketplace_sku = s.nm_id::text
       LEFT JOIN kits k ON k.id = m.kit_id
       WHERE s.date BETWEEN $1::date AND $2::date AND (s.sales_count > 0 OR s.returns_count > 0)`, [r.from, r.to]),
  ]);

  const f = funnel?.[0] || {};
  const w = fin?.[0] || {};
  const hasFinance = num(w.rows) > 0;
  const finTo: string | null = w.fin_to || null;
  const buyouts = hasFinance ? num(w.buyouts) : num(f.buyouts_sum);
  const returnsSum = hasFinance ? num(w.returns_sum) : 0;
  // Нетто-выкупы (за минусом возвратов) — база налога, комиссии и COGS
  const netBuyouts = r2(Math.max(0, buyouts - returnsSum));
  const commission = r2(netBuyouts * COMMISSION_RATE);
  const transfer = hasFinance ? num(w.transfer) : r2(buyouts - commission);
  const logistics = num(w.logistics);
  const storage = num(w.storage);
  const acceptance = num(w.acceptance);
  const other = num(w.other);
  const acquiring = num(w.acquiring);
  const commissionFact = num(w.commission_fact);
  const adSpend = num(ads?.[0]?.spend);
  // Финотчёт отстаёт от рекламы (недельный vs дневная): в «итого к оплате»
  // рекламу берём только за покрытое финотчётом окно, иначе смешиваем периоды.
  let adSpendCovered = adSpend;
  if (hasFinance && finTo && finTo < r.to) {
    const cov = await AppDataSource.query(
      `SELECT sum(spend) spend FROM mp_ad_daily
       WHERE platform='wb' AND date BETWEEN $1::date AND $2::date`, [r.from, finTo]);
    adSpendCovered = num(cov?.[0]?.spend);
  }
  const cogs = num(cogsRows?.[0]?.cogs);
  const unmappedQty = num(cogsRows?.[0]?.unmapped_qty);
  const tax = r2(netBuyouts * TAX_RATE);
  const payout = hasFinance ? r2(transfer - logistics - storage - acceptance - other - adSpendCovered) : null;
  const netProfit = payout == null ? null : r2(payout - cogs - tax);
  const totalCosts = r2(commission + logistics + storage + acceptance + other + adSpend + cogs + tax);

  return {
    ordersSum: num(f.orders_sum), ordersCount: num(f.orders_count),
    funnelBuyoutsCount: num(f.buyouts_count),
    buyouts, salesCount: hasFinance ? num(w.sales_count) : num(f.buyouts_count),
    transfer, commission, commissionFact, logistics, storage, acceptance, other,
    acquiring, adSpend, cogs, tax, payout, netProfit, totalCosts,
    netBuyouts, returnsSum, unmappedQty, finTo,
    avgSellerPrice: spp?.[0]?.avg_seller_price == null ? null : r2(num(spp[0].avg_seller_price)),
    opex: num(opex?.[0]?.expense),
    hasFinance,
  };
}

export async function wbDashboard(range: Range) {
  const prev = prevRange(range);
  const [cur, old, chart, stocks, kb] = await Promise.all([
    periodRaw(range),
    periodRaw(prev),
    AppDataSource.query(
      `SELECT date::text, sum(orders_sum)::numeric(14,2) orders_sum,
              sum(buyouts_sum)::numeric(14,2) buyouts_sum
       FROM mp_funnel_daily WHERE platform='wb' AND date BETWEEN $1::date AND $2::date
       GROUP BY date ORDER BY date`, [range.from, range.to]),
    AppDataSource.query(
      `SELECT s.date::text, sum(s.quantity)::int qty, sum(s.in_way_to_client)::int to_client,
              COALESCE(sum(s.quantity * COALESCE(NULLIF(k.total_cost,0), k.estimated_cost)), 0) cap,
              COALESCE(sum(s.quantity) FILTER (WHERE COALESCE(NULLIF(k.total_cost,0), k.estimated_cost) IS NULL), 0)::int uncosted_qty
       FROM wb_stock_daily s
       LEFT JOIN sku_mappings m ON m.marketplace_sku = s.nm_id::text
       LEFT JOIN kits k ON k.id = m.kit_id
       WHERE s.date = (SELECT max(date) FROM wb_stock_daily)
       GROUP BY s.date`),
    AppDataSource.query(
      `SELECT slug, title FROM brand_docs WHERE slug LIKE 'kb-%' ORDER BY slug`),
  ]);

  const st = stocks?.[0] || null;
  const d = (a: number | null, b: number | null): number | null =>
    a != null && b != null && b !== 0 ? r2(((a - b) / Math.abs(b)) * 100) : null;

  const M = (m: Omit<DashMetric, 'deltaPct'>): DashMetric => ({ ...m, deltaPct: d(m.value, m.prev) });

  // Финотчёт недельный и отстаёт от рекламы: если он покрывает не весь период —
  // «итого к оплате»/«чистая прибыль» посчитаны только по покрытой части.
  const partialCoverage = cur.hasFinance && cur.finTo && cur.finTo < range.to
    ? `Финотчёт заполнен по ${cur.finTo}: метрика посчитана по покрытой части периода`
    : undefined;
  const noFinanceNote = !cur.hasFinance
    ? 'Финотчёта за период ещё нет — метрика появится после автосинка'
    : undefined;
  const payoutNote = noFinanceNote || partialCoverage;
  // Немапленные на набор артикулы занижают COGS (и завышают прибыль/ROI).
  const unmappedNote = cur.unmappedQty > 0
    ? `${cur.unmappedQty} шт продаж без себестоимости (артикул не связан с набором) — COGS занижен`
    : undefined;

  const FIN_SRC = 'Финотчёт WB (wb_financial_stats ← finance-api sales-reports/detailed, автосинк ежечасно при отставании)';
  const FUNNEL_SRC = 'Воронка WB (mp_funnel_daily ← seller-analytics v3 sales-funnel, крон 06:00 UTC)';
  const ADS_SRC = 'Реклама WB (mp_ad_daily ← advert-api fullstats, крон 06:00 UTC)';

  const metrics: DashMetric[] = [
    M({ key: 'net_profit', label: 'Чистая прибыль', value: cur.netProfit, unit: 'rub',
      sub: cur.netProfit != null && cur.buyouts > 0 ? { value: pct(cur.netProfit, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.netProfit, goodWhen: 'up',
      formula: 'Итого к оплате − Себестоимость (COGS) − Налог 8% от нетто-выкупов',
      sources: [FIN_SRC, 'Себестоимость наборов (kits ← Расчёт себестоимости)', ADS_SRC],
      note: [payoutNote, unmappedNote].filter(Boolean).join('; ') || undefined }),
    M({ key: 'orders', label: 'Заказы', value: cur.ordersSum, unit: 'rub',
      sub: { value: cur.ordersCount, unit: 'pcs' }, prev: old.ordersSum, goodWhen: 'up',
      formula: 'Σ заказов за период (₽ и шт)', sources: [FUNNEL_SRC],
      series: chart.map((c: any) => ({ date: c.date, value: num(c.orders_sum) })) }),
    M({ key: 'buyouts', label: 'Продажи (выкупы)', value: cur.buyouts, unit: 'rub',
      sub: { value: cur.salesCount, unit: 'pcs' }, prev: old.buyouts, goodWhen: 'up',
      formula: 'Σ выкупов за период; при отсутствии финотчёта — из воронки',
      sources: [FIN_SRC, FUNNEL_SRC],
      series: chart.map((c: any) => ({ date: c.date, value: num(c.buyouts_sum) })) }),
    M({ key: 'buyout_pct', label: 'Процент выкупа', value: pct(cur.funnelBuyoutsCount, cur.ordersCount), unit: 'pct',
      prev: pct(old.funnelBuyoutsCount, old.ordersCount), goodWhen: 'up',
      formula: 'Выкуплено шт ÷ Заказано шт × 100%', sources: [FUNNEL_SRC] }),
    M({ key: 'commission', label: 'Комиссия ВБ (35,5%)', value: cur.commission, unit: 'rub',
      sub: { value: 35.5, unit: 'pct' }, prev: old.commission, goodWhen: 'down',
      formula: '35,5% × (выкупы − возвраты) (бизнес-константа)', sources: ['Константа COMMISSION_RATE (backend)'] }),
    M({ key: 'commission_fact', label: 'Факт-комиссия ВБ', value: cur.commissionFact || null, unit: 'rub',
      sub: cur.commissionFact && cur.buyouts > 0 ? { value: pct(cur.commissionFact, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.commissionFact || null, goodWhen: 'down',
      formula: 'Σ ppvzSalesCommission из финотчёта (вознаграждение ВБ до вычета услуг)',
      sources: [FIN_SRC], note: 'Появляется по мере перечитки истории новым парсером' }),
    M({ key: 'logistics', label: 'Логистика', value: cur.logistics, unit: 'rub',
      sub: cur.buyouts > 0 ? { value: pct(cur.logistics, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.logistics, goodWhen: 'down',
      formula: 'Σ deliveryService (стоимость доставки) из финотчёта', sources: [FIN_SRC] }),
    M({ key: 'storage', label: 'Хранение', value: cur.storage, unit: 'rub',
      sub: cur.buyouts > 0 ? { value: pct(cur.storage, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.storage, goodWhen: 'down',
      formula: 'Σ paidStorage из финотчёта (строки без артикула — «Прочее»)', sources: [FIN_SRC] }),
    M({ key: 'acceptance', label: 'Платная приёмка', value: cur.acceptance, unit: 'rub',
      prev: old.acceptance, goodWhen: 'down',
      formula: 'Σ paidAcceptance из финотчёта', sources: [FIN_SRC] }),
    M({ key: 'acquiring', label: 'Эквайринг', value: cur.acquiring || null, unit: 'rub',
      sub: cur.acquiring && cur.buyouts > 0 ? { value: pct(cur.acquiring, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.acquiring || null, goodWhen: 'down',
      formula: 'Σ acquiringFee из финотчёта', sources: [FIN_SRC],
      note: 'Появляется по мере перечитки истории новым парсером' }),
    M({ key: 'other', label: 'Прочие удержания', value: cur.other, unit: 'rub',
      prev: old.other, goodWhen: 'down',
      formula: 'Штрафы + корректировки + возмещение издержек + удержания', sources: [FIN_SRC] }),
    M({ key: 'ads', label: 'Реклама / ДРР', value: cur.adSpend, unit: 'rub',
      sub: cur.ordersSum > 0 ? { value: pct(cur.adSpend, cur.ordersSum) ?? 0, unit: 'pct' } : null,
      prev: old.adSpend, goodWhen: 'down',
      formula: 'Σ расхода РК; ДРР = расход ÷ сумма заказов × 100%', sources: [ADS_SRC] }),
    M({ key: 'cogs', label: 'Себестоимость продаж', value: cur.cogs, unit: 'rub',
      sub: cur.buyouts > 0 ? { value: pct(cur.cogs, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.cogs, goodWhen: 'down',
      formula: 'Σ ((продано − возвращено) шт × себестоимость набора); связь артикул→набор через sku_mappings',
      sources: [FIN_SRC, 'Себестоимость наборов (kits ← Расчёт себестоимости)'],
      note: unmappedNote }),
    M({ key: 'transfer', label: 'К перечислению', value: cur.transfer, unit: 'rub',
      sub: cur.buyouts > 0 ? { value: pct(cur.transfer, cur.buyouts) ?? 0, unit: 'pct' } : null,
      prev: old.transfer, goodWhen: 'up',
      formula: cur.hasFinance ? 'Σ forPay из финотчёта' : 'Оценка: выкупы − комиссия 35,5% (финотчёта за период ещё нет)',
      sources: [FIN_SRC], note: cur.hasFinance ? undefined : noFinanceNote }),
    M({ key: 'payout', label: 'Итого к оплате', value: cur.payout, unit: 'rub',
      prev: old.payout, goodWhen: 'up',
      formula: 'К перечислению − логистика − хранение − приёмка − прочие − реклама',
      sources: [FIN_SRC, ADS_SRC], note: payoutNote }),
    M({ key: 'tax_base', label: 'Налоговая база', value: cur.netBuyouts, unit: 'rub',
      prev: old.netBuyouts, goodWhen: 'up',
      formula: 'Выкупы − возвраты (доход по УСН)', sources: [FIN_SRC] }),
    M({ key: 'tax', label: 'Налоги (8%)', value: cur.tax, unit: 'rub',
      prev: old.tax, goodWhen: 'down',
      formula: '8% × налоговая база (константа TAX_RATE)', sources: ['Константа TAX_RATE (backend)'] }),
    M({ key: 'roi', label: 'ROI', value: cur.netProfit != null && cur.totalCosts > 0 ? pct(cur.netProfit, cur.totalCosts) : null, unit: 'pct',
      prev: old.netProfit != null && old.totalCosts > 0 ? pct(old.netProfit, old.totalCosts) : null, goodWhen: 'up',
      formula: 'Чистая прибыль ÷ (все расходы + COGS + налог) × 100%',
      sources: [FIN_SRC, ADS_SRC, 'Себестоимость наборов'],
      note: [payoutNote, unmappedNote].filter(Boolean).join('; ') || undefined }),
    M({ key: 'avg_price', label: 'Цена до СПП', value: cur.avgSellerPrice, unit: 'rub',
      prev: old.avgSellerPrice, goodWhen: 'up',
      formula: 'Средняя цена продавца по реальным заказам за период',
      sources: ['Заказы WB (spp_order ← statistics /orders, крон 05:00 UTC)'] }),
    M({ key: 'opex', label: 'Операционные расходы', value: cur.opex || null, unit: 'rub',
      prev: old.opex || null, goodWhen: 'down',
      formula: 'Σ транзакций типа «расход» из финконтура ERP за период',
      sources: ['Транзакции ERP (transactions + categories)'],
      note: cur.opex ? undefined : 'Транзакции почти не ведутся — данных нет' }),
    M({ key: 'stock', label: 'Остатки', value: st ? num(st.qty) : null, unit: 'pcs',
      sub: st ? { value: num(st.to_client), unit: 'pcs' } : null,
      prev: null, goodWhen: 'up',
      formula: 'Доступно на складах WB (+ в пути к клиенту); снапшот раз в день',
      sources: ['Остатки WB (wb_stock_daily ← seller-analytics stocks-report, крон 06:00 UTC)'],
      note: st ? `на ${st.date}` : 'Первый снапшот появится после ближайшего крона' }),
    M({ key: 'capitalization', label: 'Капитализация по себес.', value: st ? r2(num(st.cap)) : null, unit: 'rub',
      prev: null, goodWhen: 'up',
      formula: 'Σ (остаток шт × себестоимость набора)',
      sources: ['Остатки WB (wb_stock_daily)', 'Себестоимость наборов (kits)'],
      note: st && num(st.uncosted_qty) > 0 ? `${num(st.uncosted_qty)} шт на складах без себестоимости — капитализация занижена` : undefined }),
  ];

  const warnings = [noFinanceNote, partialCoverage, unmappedNote].filter(Boolean) as string[];

  return {
    range, prevRange: prev,
    chart: chart.map((c: any) => ({ date: c.date, orders_sum: num(c.orders_sum), buyouts_sum: num(c.buyouts_sum) })),
    metrics,
    kb,
    finance_fresh: cur.hasFinance,
    finance_to: cur.finTo,
    warnings,
    generated_at: new Date().toISOString(),
  };
}
