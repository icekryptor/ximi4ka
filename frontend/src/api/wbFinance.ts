import { apiClient } from './client';
import { WbFinanceAnalytics, WbFinanceArticle, WbFinanceSyncStatus, WbTokenStatus } from './types';

export const wbFinanceApi = {
  // Token
  getTokenStatus: async () => {
    const response = await apiClient.get<WbTokenStatus>('/wb-finance/token/status');
    return response.data;
  },

  saveToken: async (token: string) => {
    const response = await apiClient.post<WbTokenStatus & { success: boolean }>('/wb-finance/token', { token });
    return response.data;
  },

  // Sync
  syncStats: async (startDate: string, endDate: string) => {
    const response = await apiClient.post<{ synced: number; rawRows: number; message: string }>(
      '/wb-finance/sync',
      { startDate, endDate }
    );
    return response.data;
  },

  getSyncStatus: async () => {
    const response = await apiClient.get<WbFinanceSyncStatus>('/wb-finance/sync-status');
    return response.data;
  },

  // Analytics
  getAnalytics: async (params: { startDate: string; endDate: string; nmId?: number; groupBy?: 'day' | 'week' }) => {
    const response = await apiClient.get<WbFinanceAnalytics>('/wb-finance/analytics', { params });
    return response.data;
  },

  getArticles: async () => {
    const response = await apiClient.get<WbFinanceArticle[]>('/wb-finance/articles');
    return response.data;
  },
};
