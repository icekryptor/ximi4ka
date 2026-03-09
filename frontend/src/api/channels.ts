import { apiClient } from './client';

export enum MarketplaceType {
  WILDBERRIES = 'wildberries',
  OZON = 'ozon',
  DETMIR = 'detmir',
  WEBSITE = 'website',
  OTHER = 'other',
}

export const MARKETPLACE_LABELS: Record<MarketplaceType, string> = {
  [MarketplaceType.WILDBERRIES]: 'Wildberries',
  [MarketplaceType.OZON]: 'Ozon',
  [MarketplaceType.DETMIR]: 'Детский мир',
  [MarketplaceType.WEBSITE]: 'Сайт',
  [MarketplaceType.OTHER]: 'Другое',
};

export interface SalesChannel {
  id: string;
  name: string;
  marketplace_type: MarketplaceType;
  commission_pct: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend_pct: number;
  return_rate_pct: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const channelsApi = {
  getAll: async () => {
    const response = await apiClient.get<SalesChannel[]>('/channels');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<SalesChannel>(`/channels/${id}`);
    return response.data;
  },

  create: async (data: Partial<SalesChannel>) => {
    const response = await apiClient.post<SalesChannel>('/channels', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SalesChannel>) => {
    const response = await apiClient.put<SalesChannel>(`/channels/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/channels/${id}`);
    return response.data;
  },
};
