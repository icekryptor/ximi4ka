import { apiClient } from './client';
import { Supply } from './types';

export interface CreateSupplyData {
  supplier_id?: string;
  carrier_id?: string;
  delivery_cost?: number;
  supply_date?: string;
  notes?: string;
  items: {
    component_id: string;
    quantity: number;
    price_mode: 'unit' | 'total';
    entered_price: number;
  }[];
}

export const suppliesApi = {
  getAll: async (params?: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    componentId?: string;
  }) => {
    const response = await apiClient.get<Supply[]>('/supplies', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Supply>(`/supplies/${id}`);
    return response.data;
  },

  create: async (data: CreateSupplyData) => {
    const response = await apiClient.post<Supply>('/supplies', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateSupplyData>) => {
    const response = await apiClient.put<Supply>(`/supplies/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/supplies/${id}`);
    return response.data;
  },
};
