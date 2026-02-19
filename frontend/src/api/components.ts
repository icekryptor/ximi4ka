import { apiClient } from './client';

export interface Component {
  id: string;
  name: string;
  category: 'reagent' | 'equipment' | 'print' | 'labor';
  purchase_cost?: number;
  batch_weight?: number;
  per_kit_amount?: number;
  price_per_gram?: number;
  delivery_cost?: number;
  batch_quantity?: number;
  unit_price: number;
  quantity_per_kit: number;
  price_per_kit: number;
  supplier_id?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const componentsApi = {
  getAll: async (params?: {
    category?: string;
    active?: boolean;
  }) => {
    const response = await apiClient.get<Component[]>('/components', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Component>(`/components/${id}`);
    return response.data;
  },

  create: async (data: Partial<Component>) => {
    const response = await apiClient.post<Component>('/components', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Component>) => {
    const response = await apiClient.put<Component>(`/components/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/components/${id}`);
    return response.data;
  },

  bulkImport: async (components: Partial<Component>[]) => {
    const response = await apiClient.post('/components/bulk-import', { components });
    return response.data;
  },
};
