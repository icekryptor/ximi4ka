import { apiClient } from './client';
import { Kit } from './kits';

// Types
export interface DailySalesEntry {
  id: string;
  date: string;
  channel_name: string;
  kit_id: string;
  kit?: Kit;
  source: string;
  sales_count: number;
  revenue_per_unit: number;
  total_revenue: number;
  cost_price_per_unit: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend: number;
  other_costs: number;
  total_costs: number;
  profit: number;
  margin: number;
  created_at: string;
  updated_at: string;
}

export interface SalesReportData {
  dates: string[];
  metrics: Record<string, number[]>;
  totals: Record<string, number>;
  kits: Array<{ id: string; name: string; seller_sku: string | null }>;
  channels: string[];
}

export interface SalesReportSummary {
  channels: Array<{
    channel_name: string;
    total_revenue: number;
    total_profit: number;
    avg_margin: number;
    total_sales: number;
  }>;
  period: { startDate: string; endDate: string };
}

export interface SalesReportParams {
  startDate: string;
  endDate: string;
  channel?: string;
  kitId?: string;
}

export interface ManualSalesInput {
  date: string;
  channel_name: string;
  kit_id: string;
  sales_count: number;
  revenue_per_unit: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend: number;
  other_costs: number;
}

export const CHANNEL_OPTIONS = ['ВБ', 'Озон', 'Сайт', 'Оптовые продажи'];

export const METRIC_ROWS = [
  { key: 'revenue_per_unit', label: 'Доход/ед.', format: 'currency' as const },
  { key: 'sales_count', label: 'Количество', format: 'int' as const },
  { key: 'total_revenue', label: 'Общий доход', format: 'currency' as const },
  { key: 'logistics_cost', label: 'Логистика', format: 'currency' as const },
  { key: 'storage_cost', label: 'Хранение', format: 'currency' as const },
  { key: 'ad_spend', label: 'Реклама', format: 'currency' as const },
  { key: 'other_costs', label: 'Прочие расходы', format: 'currency' as const },
  { key: 'profit', label: 'Прибыль', format: 'currency' as const, highlight: true },
  { key: 'margin', label: 'Маржа (%)', format: 'percent' as const, highlight: true },
];

// API
export const salesReportApi = {
  getReport(params: SalesReportParams) {
    return apiClient.get<SalesReportData>('/sales-report', { params }).then(r => r.data);
  },

  getSummary(params: { startDate: string; endDate: string }) {
    return apiClient.get<SalesReportSummary>('/sales-report/summary', { params }).then(r => r.data);
  },

  getEntries(params: SalesReportParams) {
    return apiClient.get<DailySalesEntry[]>('/sales-report/entries', { params }).then(r => r.data);
  },

  syncFromWb(startDate: string, endDate: string) {
    return apiClient.post<{ synced: number; unmapped: number[]; message: string }>(
      '/sales-report/sync-wb',
      { startDate, endDate }
    ).then(r => r.data);
  },

  createOrUpdate(data: ManualSalesInput) {
    return apiClient.post<DailySalesEntry>('/sales-report', data).then(r => r.data);
  },

  delete(id: string) {
    return apiClient.delete(`/sales-report/${id}`).then(r => r.data);
  },
};
