import { apiClient } from './client';
import { Kit } from './kits';
import { SalesChannel } from './channels';

export interface UnitEconomics {
  id: string;
  kit_id: string;
  kit?: Kit;
  channel_id: string;
  channel?: SalesChannel;
  period?: string;
  selling_price: number;
  cost_price: number;
  commission_pct: number;
  commission_amount: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend_pct: number;
  ad_spend_amount: number;
  return_rate_pct: number;
  unit_margin: number;
  margin_pct: number;
  created_at: string;
  updated_at: string;
}

export interface CalculateParams {
  kit_id: string;
  channel_id: string;
  selling_price: number;
  period?: string;
  logistics_cost?: number;
  storage_cost?: number;
  commission_pct?: number;
  ad_spend_pct?: number;
}

export interface MarginMatrixRow {
  kit_id: string;
  kit_name: string;
  sku: string;
  cost_price: number;
  channels: Array<{
    channel_id: string;
    channel_name: string;
    selling_price: number;
    commission_amount: number;
    logistics_cost: number;
    storage_cost: number;
    ad_spend_amount: number;
    unit_margin: number;
    margin_pct: number;
  }>;
}

export interface MarginMatrixResponse {
  channels: Array<{ id: string; name: string }>;
  rows: MarginMatrixRow[];
}

export const economicsApi = {
  getAll: async (params?: { kit_id?: string; channel_id?: string; period?: string }) => {
    const response = await apiClient.get<UnitEconomics[]>('/economics/unit', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<UnitEconomics>(`/economics/unit/${id}`);
    return response.data;
  },

  calculate: async (data: CalculateParams) => {
    const response = await apiClient.post<UnitEconomics>('/economics/unit/calculate', data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/economics/unit/${id}`);
    return response.data;
  },

  marginMatrix: async (params?: { selling_prices?: Record<string, number> }) => {
    const response = await apiClient.post<MarginMatrixResponse>('/economics/margin/matrix', params || {});
    return response.data;
  },
};
