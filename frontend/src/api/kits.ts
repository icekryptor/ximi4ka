import { apiClient } from './client';
import { Component } from './components';

export interface Kit {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  batch_size: number;
  reagents_cost: number;
  equipment_cost: number;
  print_cost: number;
  labor_cost: number;
  total_cost: number;
  retail_price?: number;
  wholesale_price?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CostCalculation {
  kit_id: string;
  kit_name: string;
  breakdown: {
    reagents: number;
    equipment: number;
    print: number;
    labor: number;
  };
  total: number;
  details: {
    reagents: Array<{ name: string; cost: number }>;
    equipment: Array<{ name: string; cost: number }>;
    print: Array<{ name: string; cost: number }>;
    labor: Array<{ name: string; cost: number }>;
  };
}

export const kitsApi = {
  getAll: async () => {
    const response = await apiClient.get<Kit[]>('/kits');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Kit>(`/kits/${id}`);
    return response.data;
  },

  create: async (data: Partial<Kit>) => {
    const response = await apiClient.post<Kit>('/kits', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Kit>) => {
    const response = await apiClient.put<Kit>(`/kits/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/kits/${id}`);
    return response.data;
  },

  calculate: async (id: string) => {
    const response = await apiClient.get<CostCalculation>(`/kits/${id}/calculate`);
    return response.data;
  },
};
