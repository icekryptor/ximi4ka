import { apiClient } from './client';

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
  category: 'reagent' | 'equipment' | 'print' | 'labor';
  dimensions?: string;
  link_1688?: string;
  factory?: string;
  weight_kg?: number;
  unit_price: number;
  quantity_per_kit: number;
  price_per_kit: number;
  is_composite: boolean;
  parts?: ComponentPart[];       // только для сложных, только при getById
  supplier_id?: string;
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
    const response = await apiClient.post('/components/bulk-import', { components });
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
};
