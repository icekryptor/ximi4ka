import { apiClient } from './client';
import { Counterparty } from './types';

export interface ComponentPart {
  id: string;
  composite_id: string;
  part_id: string;
  quantity: number;
  part: Component;
  created_at: string;
}

export interface Component {
  id: string;
  name: string;
  sku?: string;
  category: 'reagent' | 'metal' | 'equipment' | 'print' | 'labor';
  dimensions?: string;
  product_url?: string;
  link_1688?: string;  // legacy alias
  regulation_url?: string;
  factory?: string;
  weight_kg?: number;
  // Структура стоимости
  cost_materials: number;   // стоимость материалов
  cost_logistics: number;   // стоимость логистики
  cost_labor: number;       // стоимость работы
  unit_price: number;       // итого = materials + logistics + labor
  quantity_per_kit: number;
  price_per_kit: number;
  per_kit_amount?: number;   // для реактивов: масса в 1 флаконе, г
  is_composite: boolean;
  parts?: ComponentPart[];       // только для сложных, только при getById
  supplier_id?: string;
  supplier?: Counterparty;
  carrier_id?: string;
  carrier?: Counterparty;
  image_url?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const componentsApi = {
  getAll: async (params?: { category?: string; active?: boolean; onlySimple?: boolean }) => {
    const response = await apiClient.get<Component[]>('/components', { params });
    const data = response.data;
    if (params?.onlySimple) return data.filter(c => !c.is_composite);
    return data;
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

  uploadImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post<{ image_url: string }>(
      `/components/${id}/image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  bulkImport: async (components: Partial<Component>[]) => {
    const response = await apiClient.post<{ imported: number; updated: number; errors: string[] }>(
      '/components/bulk-import',
      { components }
    );
    return response.data;
  },

  // Состав сложного компонента
  getParts: async (compositeId: string) => {
    const response = await apiClient.get<ComponentPart[]>(`/components/${compositeId}/parts`);
    return response.data;
  },

  addPart: async (compositeId: string, partId: string, quantity: number = 1) => {
    const response = await apiClient.post<ComponentPart>(`/components/${compositeId}/parts`, {
      part_id: partId,
      quantity,
    });
    return response.data;
  },

  updatePart: async (compositeId: string, partEntryId: string, quantity: number) => {
    const response = await apiClient.put(
      `/components/${compositeId}/parts/${partEntryId}`,
      { quantity }
    );
    return response.data;
  },

  removePart: async (compositeId: string, partEntryId: string) => {
    const response = await apiClient.delete(
      `/components/${compositeId}/parts/${partEntryId}`
    );
    return response.data;
  },

  deleteAll: async () => {
    const response = await apiClient.delete('/components/all');
    return response.data;
  },
};
