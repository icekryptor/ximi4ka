/**
 * Wildberries API Service
 * Advertising API: https://advert-api.wildberries.ru (300 req/min)
 * Statistics API:  https://statistics-api.wildberries.ru (~1 req/min)
 * Auth: Bearer token (WB_API_TOKEN)
 */

const WB_ADV_BASE_URL = 'https://advert-api.wildberries.ru';
const WB_STATS_BASE_URL = 'https://statistics-api.wildberries.ru';

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

  constructor() {
    this.token = process.env.WB_API_TOKEN || '';
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

  private async request<T>(url: string, options: RequestInit = {}, retries = 3): Promise<T> {
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
          // Rate limited — wait and retry
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`WB API rate limited (429), waiting ${waitMs}ms (attempt ${attempt}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
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
        if (!text) return {} as T;
        return JSON.parse(text) as T;
      } catch (error: any) {
        if (attempt === retries) throw error;
        if (error.message?.includes('WB API error: 4')) throw error; // Don't retry 4xx (except 429)
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
   * GET /adv/v3/fullstats — campaign statistics (max 31 days per request)
   * Automatically splits date ranges > 31 days
   */
  async getFullStats(
    campaignIds: number[],
    beginDate: string,
    endDate: string
  ): Promise<WbFullStatsItem[]> {
    if (campaignIds.length === 0) return [];

    const windows = this.splitDateRange(beginDate, endDate, 31);
    const allResults: WbFullStatsItem[] = [];

    for (const window of windows) {
      const idsParam = campaignIds.join(',');
      const url = `${WB_ADV_BASE_URL}/adv/v3/fullstats?ids=${idsParam}&beginDate=${window.begin}&endDate=${window.end}`;

      const data = await this.request<WbFullStatsItem[]>(url);
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
        const data = await this.request<WbReportDetailRow[]>(url, {}, 3);

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
