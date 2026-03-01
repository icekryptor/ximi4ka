import { apiClient } from './client';
import { MarketplaceSale, SkuMapping, MarketplaceAnalytics } from './types';

export const marketplaceApi = {
  // Sales
  getSales: async (params?: {
    marketplace?: string;
    startDate?: string;
    endDate?: string;
    sku?: string;
  }) => {
    const response = await apiClient.get<MarketplaceSale[]>('/marketplace/sales', { params });
    return response.data;
  },

  createSale: async (data: Partial<MarketplaceSale>) => {
    const response = await apiClient.post<MarketplaceSale>('/marketplace/sales', data);
    return response.data;
  },

  updateSale: async (id: string, data: Partial<MarketplaceSale>) => {
    const response = await apiClient.put<MarketplaceSale>(`/marketplace/sales/${id}`, data);
    return response.data;
  },

  deleteSale: async (id: string) => {
    const response = await apiClient.delete(`/marketplace/sales/${id}`);
    return response.data;
  },

  // Import
  importSales: async (file: File, marketplace: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('marketplace', marketplace);
    const response = await apiClient.post('/marketplace/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  confirmImportSales: async (rows: any[]): Promise<{ imported: number }> => {
    const response = await apiClient.post<{ imported: number }>('/marketplace/import/confirm', { rows });
    return response.data;
  },

  // Analytics
  getAnalytics: async (marketplace: string, params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await apiClient.get<MarketplaceAnalytics>(`/marketplace/analytics/${marketplace}`, { params });
    return response.data;
  },

  // SKU Mappings
  getSkuMappings: async () => {
    const response = await apiClient.get<SkuMapping[]>('/marketplace/sku-mappings');
    return response.data;
  },

  createSkuMapping: async (data: Partial<SkuMapping>) => {
    const response = await apiClient.post<SkuMapping>('/marketplace/sku-mappings', data);
    return response.data;
  },

  updateSkuMapping: async (id: string, data: Partial<SkuMapping>) => {
    const response = await apiClient.put<SkuMapping>(`/marketplace/sku-mappings/${id}`, data);
    return response.data;
  },

  deleteSkuMapping: async (id: string) => {
    const response = await apiClient.delete(`/marketplace/sku-mappings/${id}`);
    return response.data;
  },
};
