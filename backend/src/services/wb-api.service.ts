/**
 * Wildberries API Service
 * Advertising API: https://advert-api.wildberries.ru (300 req/min)
 * Statistics API:  https://statistics-api.wildberries.ru (~1 req/min)
 * Auth: Bearer token (WB_API_TOKEN)
 */

const WB_ADV_BASE_URL = 'https://advert-api.wildberries.ru';
const WB_STATS_BASE_URL = 'https://statistics-api.wildberries.ru';
const WB_ANALYTICS_BASE_URL = 'https://seller-analytics-api.wildberries.ru';

interface WbCampaign {
  advertId: number;
  type: number;
  status: number;
  name?: string;
}

interface WbCampaignCountResponse {
  adverts?: Array<{
    type: number;
    status: number;
    count: number;
    advert_list?: Array<{
      advertId: number;
      changeTime: string;
    }>;
  }>;
}

interface WbNmStats {
  nmId: number;
  name: string;
  views: number;
  clicks: number;
  ctr: number;
  cpc: number;
  sum: number;
  atbs: number;
  orders: number;
  cr: number;
  shks: number;
  sum_price: number;
  canceled: number;
}

interface WbDayStats {
  date: string;
  apps: Array<{
    appType: number;
    nms: WbNmStats[];
  }>;
}

/**
 * A single row from /api/v5/supplier/reportDetailByPeriod
 * Contains per-sale financial data
 */
export interface WbReportDetailRow {
  realizationreport_id: number;
  date_from: string;
  date_to: string;
  create_dt: string;
  currency_name: string;
  suppliercontract_code: string | null;
  rrd_id: number;
  gi_id: number;
  subject_name: string;
  nm_id: number;
  brand_name: string;
  sa_name: string;        // артикул поставщика
  ts_name: string;
  barcode: string;
  doc_type_name: string;  // 'Продажа' | 'Возврат' | ...
  quantity: number;
  retail_price: number;
  retail_amount: number;  // сумма продаж в розничных ценах
  sale_percent: number;
  commission_percent: number;
  office_name: string;
  supplier_oper_name: string;
  order_dt: string;
  sale_dt: string;
  rr_dt: string;
  shk_id: number;
  retail_price_withdisc_rub: number;
  delivery_amount: number;
  return_amount: number;
  delivery_rub: number;       // стоимость логистики
  gi_box_type_name: string;
  product_discount_for_report: number;
  supplier_promo: number;
  rid: number;
  ppvz_spp_prc: number;
  ppvz_kvw_prc_base: number;
  ppvz_kvw_prc: number;
  sup_rating_prc_up: number;
  is_kgvp_v2: number;
  ppvz_sales_commission: number;
  ppvz_for_pay: number;       // к перечислению
  ppvz_reward: number;
  acquiring_fee: number;
  acquiring_bank: string;
  ppvz_vw: number;
  ppvz_vw_nds: number;
  ppvz_office_id: number;
  ppvz_office_name: string;
  ppvz_supplier_id: number;
  ppvz_supplier_name: string;
  ppvz_inn: string;
  declaration_number: string;
  bonus_type_name: string;
  sticker_id: string;
  site_country: string;
  penalty: number;             // штрафы
  additional_payment: number;  // доплаты
  rebill_logistic_cost: number;
  rebill_logistic_org: string;
  kiz: string;
  storage_fee: number;         // хранение
  deduction: number;
  acceptance: number;          // приёмка
  srid: string;
  report_type: number;
}

/** Строка /api/v1/supplier/orders — заказ покупателя (для фактической СПП). */
export interface WbOrderRow {
  date: string;
  lastChangeDate: string;
  nmId: number;
  srid: string;
  gNumber: string;
  totalPrice: number;       // цена до скидок
  discountPercent: number;  // скидка продавца, %
  spp: number;              // СПП, % (скидка постоянного покупателя)
  finishedPrice: number;    // фактическая цена покупателя (с СПП)
  priceWithDisc: number;    // цена продавца (после его скидки)
  isCancel: boolean;
  regionName?: string;
  oblastOkrugName?: string;
}

/** Точка истории nm-report/detail/history — день × артикул (воронка + продажи). */
export interface WbNmHistoryPoint {
  dt: string;
  openCardCount?: number;      // показы/переходы в карточку
  addToCartCount?: number;     // положили в корзину
  ordersCount?: number;
  ordersSumRub?: number;
  buyoutsCount?: number;
  buyoutsSumRub?: number;
  cancelCount?: number;
  cancelSumRub?: number;
  addToCartConversion?: number;
  cartToOrderConversion?: number;
  buyoutPercent?: number;
  avgPriceRub?: number;
}
export interface WbNmHistoryItem {
  nmID: number;
  vendorCode?: string;
  imtName?: string;
  history: WbNmHistoryPoint[];
}

interface WbFullStatsItem {
  advertId: number;
  views: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cr: number;
  orders: number;
  shks: number;
  sum: number;
  sum_price: number;
  atbs: number;
  canceled: number;
  days: WbDayStats[];
}

export class WbApiService {
  private token: string;
  private lastRequestTime = 0;
  private minInterval = 200; // 5 req/sec = 300/min

  // ── Общий «предохранитель» на 429 ──────────────────────────────────────────
  // Лимит WB — на аккаунт продавца (общий для advert/statistics/nm-report).
  // Один 429 → приостанавливаем ВСЕ WB-запросы на COOLDOWN_MS, чтобы не долбить
  // ретраями и не продлевать бан. Успешный ответ сбрасывает паузу.
  private cooldownUntil = 0;
  private static readonly COOLDOWN_MS = Number(process.env.WB_COOLDOWN_MS) || 30 * 60 * 1000; // 30 мин

  constructor() {
    this.token = process.env.WB_API_TOKEN || '';
  }

  /** Сколько ещё «остывать» после 429 (мс). 0 — можно слать запрос. */
  cooldownRemainingMs(): number {
    return Math.max(0, this.cooldownUntil - Date.now());
  }

  /** Update token at runtime (also persists to process.env) */
  setToken(token: string): void {
    this.token = token;
    process.env.WB_API_TOKEN = token;
  }

  /** Check if token is configured */
  hasToken(): boolean {
    return !!this.token;
  }

  /** Get masked token for display (first 8 + last 4 chars) */
  getMaskedToken(): string | null {
    if (!this.token) return null;
    if (this.token.length <= 16) return '****';
    return this.token.slice(0, 8) + '...' + this.token.slice(-4);
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
    retries = 3,
    rate429Ms?: number,
  ): Promise<T> {
    // Предохранитель: если недавно поймали 429 — не трогаем WB до конца паузы.
    const rem = this.cooldownRemainingMs();
    if (rem > 0) {
      throw new Error(`WB API: пауза после лимита, ещё ${Math.ceil(rem / 1000)}с — запрос пропущен`);
    }

    await this.throttle();

    if (!this.token) {
      throw new Error('WB_API_TOKEN не задан в .env');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 429) {
          // Эндпоинты с известным тесным лимитом (nm-report 3/min, statistics 1/min)
          // передают rate429Ms: их 429 — штатный пейсинг, пережидаем и повторяем,
          // глобальную паузу не включаем.
          if (rate429Ms && attempt < retries) {
            console.warn(`WB API 429 (пейсинг), жду ${rate429Ms}ms (attempt ${attempt}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, rate429Ms));
            continue;
          }
          // Неожиданный 429 (или ретраи исчерпаны) — глобальный кулдаун на все
          // WB-запросы, чтобы не продлевать бан долбёжкой.
          const retryAfterMs = (Number(response.headers.get('retry-after')) || 0) * 1000;
          this.cooldownUntil = Date.now() + Math.max(WbApiService.COOLDOWN_MS, retryAfterMs);
          const mins = Math.round(this.cooldownRemainingMs() / 60000);
          console.warn(`WB API 429 — пауза ~${mins} мин, все WB-запросы приостановлены`);
          throw new Error(`WB API error: 429 — лимит, пауза ~${mins} мин`);
        }

        if (response.status >= 500) {
          if (attempt < retries) {
            const waitMs = 1000 * Math.pow(2, attempt);
            console.warn(`WB API 5xx error (${response.status}), retrying in ${waitMs}ms (attempt ${attempt}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          throw new Error(`WB API error: ${response.status} ${response.statusText}`);
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`WB API error: ${response.status} — ${body}`);
        }

        const text = await response.text();
        this.cooldownUntil = 0; // успех — снимаем паузу
        if (!text) return {} as T;
        return JSON.parse(text) as T;
      } catch (error: any) {
        if (attempt === retries) throw error;
        if (error.message?.includes('WB API error: 4')) throw error; // 4xx (вкл. 429) — не ретраим
        const waitMs = 1000 * Math.pow(2, attempt);
        console.warn(`WB API request failed, retrying in ${waitMs}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
    throw new Error('WB API: max retries exceeded');
  }

  /**
   * GET /adv/v1/promotion/count — list all campaigns
   */
  async getCampaigns(): Promise<WbCampaign[]> {
    const data = await this.request<WbCampaignCountResponse>(
      `${WB_ADV_BASE_URL}/adv/v1/promotion/count`
    );

    const campaigns: WbCampaign[] = [];
    if (data.adverts) {
      for (const group of data.adverts) {
        if (group.advert_list) {
          for (const advert of group.advert_list) {
            campaigns.push({
              advertId: advert.advertId,
              type: group.type,
              status: group.status,
            });
          }
        }
      }
    }
    return campaigns;
  }

  /**
   * GET /adv/v3/fullstats — campaign statistics (max 31 days per request,
   * max 50 campaign ids per request). Splits both dimensions automatically.
   */
  async getFullStats(
    campaignIds: number[],
    beginDate: string,
    endDate: string
  ): Promise<WbFullStatsItem[]> {
    if (campaignIds.length === 0) return [];
    if (campaignIds.length > 50) {
      const out: WbFullStatsItem[] = [];
      for (let i = 0; i < campaignIds.length; i += 50) {
        out.push(...await this.getFullStats(campaignIds.slice(i, i + 50), beginDate, endDate));
      }
      return out;
    }

    const windows = this.splitDateRange(beginDate, endDate, 31);
    const allResults: WbFullStatsItem[] = [];

    let first = true;
    for (const window of windows) {
      // fullstats лимитирован ~1 req/min — пауза между окнами + пейсинг-ретрай на 429
      if (!first) await new Promise(resolve => setTimeout(resolve, 62_000));
      first = false;
      const idsParam = campaignIds.join(',');
      const url = `${WB_ADV_BASE_URL}/adv/v3/fullstats?ids=${idsParam}&beginDate=${window.begin}&endDate=${window.end}`;

      const data = await this.request<WbFullStatsItem[]>(url, {}, 3, 65_000);
      if (Array.isArray(data)) {
        allResults.push(...data);
      }
    }

    return allResults;
  }

  /**
   * GET /api/v5/supplier/reportDetailByPeriod — financial report
   * Statistics API (different base URL, ~1 req/min rate limit)
   * Max 90 days per request. Uses cursor-based pagination via rrdid.
   * Automatically splits date ranges > 90 days.
   */
  async getReportDetailByPeriod(
    dateFrom: string,
    dateTo: string
  ): Promise<WbReportDetailRow[]> {
    const windows = this.splitDateRange(dateFrom, dateTo, 90);
    const allRows: WbReportDetailRow[] = [];

    for (const window of windows) {
      let rrdid = 0;
      let hasMore = true;

      while (hasMore) {
        const url = `${WB_STATS_BASE_URL}/api/v5/supplier/reportDetailByPeriod?dateFrom=${window.begin}&dateTo=${window.end}&rrdid=${rrdid}&limit=100000`;
        const data = await this.request<WbReportDetailRow[]>(url, {}, 3, 65_000); // statistics 1 req/min

        if (Array.isArray(data) && data.length > 0) {
          allRows.push(...data);
          // Use last rrd_id as cursor for next page
          rrdid = data[data.length - 1].rrd_id;
          // If we got less than 100000 rows, there are no more pages
          if (data.length < 100000) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
    }

    return allRows;
  }

  /**
   * GET /api/v1/supplier/orders — заказы покупателей (Statistics API).
   * flag=0 → отдаёт заказы с lastChangeDate >= dateFrom, до 80k строк за ответ;
   * пагинация курсором по max(lastChangeDate). Дедуп по srid.
   */
  async getOrders(dateFrom: string): Promise<WbOrderRow[]> {
    const all: WbOrderRow[] = [];
    const seen = new Set<string>();
    let cursor = dateFrom;

    for (let guard = 0; guard < 50; guard++) {
      const url = `${WB_STATS_BASE_URL}/api/v1/supplier/orders?dateFrom=${encodeURIComponent(cursor)}&flag=0`;
      // Statistics /orders лимит 1 req/min → длинный бэкофф на 429
      const data = await this.request<WbOrderRow[]>(url, {}, 4, 65_000);
      if (!Array.isArray(data) || data.length === 0) break;

      let added = 0;
      let maxChange = cursor;
      for (const row of data) {
        const key = row.srid || `${row.gNumber}-${row.nmId}-${row.date}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(row);
          added++;
        }
        if (row.lastChangeDate > maxChange) maxChange = row.lastChangeDate;
      }
      // конец: страница неполная, курсор не двинулся или ничего нового
      if (data.length < 80000 || maxChange === cursor || added === 0) break;
      cursor = maxChange;
    }

    return all;
  }

  /**
   * Дневная воронка+продажи по артикулам.
   * WB удалил /api/v2/nm-report/detail/history (~08.07.2026, 404 «path not found») —
   * новый метод: POST /api/analytics/v3/sales-funnel/products/history
   * (selectedPeriod{start,end}, nmIds ≤20, aggregationLevel day; данные МАКС за
   * последнюю неделю — глубже только CSV c подпиской Джем). Лимит ~3 req/min.
   * Ответ: [{product:{...}, history:[...]}] — адаптируем к старой форме WbNmHistoryItem.
   */
  async getNmReportHistory(nmIds: number[], begin: string, end: string): Promise<WbNmHistoryItem[]> {
    // новый метод отдаёт максимум последнюю неделю — клампим начало
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const start = begin < weekAgo ? weekAgo : begin;
    const out: WbNmHistoryItem[] = [];
    for (let i = 0; i < nmIds.length; i += 20) {
      const chunk = nmIds.slice(i, i + 20);
      const body = JSON.stringify({
        selectedPeriod: { start, end },
        nmIds: chunk,
        aggregationLevel: 'day',
      });
      const url = `${WB_ANALYTICS_BASE_URL}/api/analytics/v3/sales-funnel/products/history`;
      const resp = await this.request<any>(url, { method: 'POST', body }, 4, 25_000);
      // толерантный разбор: массив может лежать в корне или в data
      const items: any[] = Array.isArray(resp) ? resp : (Array.isArray(resp?.data) ? resp.data : []);
      for (const it of items) {
        const prod = it.product ?? it;
        out.push({
          nmID: Number(prod.nmId ?? prod.nmID ?? prod.id) || 0,
          vendorCode: prod.vendorCode ?? prod.article ?? undefined,
          imtName: prod.title ?? prod.imtName ?? prod.name ?? undefined,
          history: (it.history ?? []).map((p: any) => ({
            ...p,
            dt: p.dt ?? p.date ?? p.day,
          })),
        });
      }
    }
    return out;
  }

  /**
   * Split a date range into windows of maxDays each
   */
  private splitDateRange(beginDate: string, endDate: string, maxDays: number): Array<{ begin: string; end: string }> {
    const windows: Array<{ begin: string; end: string }> = [];
    let current = new Date(beginDate);
    const end = new Date(endDate);

    while (current <= end) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + maxDays - 1);
      if (windowEnd > end) windowEnd.setTime(end.getTime());

      windows.push({
        begin: current.toISOString().split('T')[0],
        end: windowEnd.toISOString().split('T')[0],
      });

      current = new Date(windowEnd);
      current.setDate(current.getDate() + 1);
    }

    return windows;
  }
}

export const wbApiService = new WbApiService();
