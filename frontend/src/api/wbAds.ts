import { apiClient } from './client';
import { WbAdAnalytics, WbAdNote, WbAdArticle, WbAdSyncStatus, WbTokenStatus } from './types';

export const wbAdsApi = {
  // Token
  getTokenStatus: async () => {
    const response = await apiClient.get<WbTokenStatus>('/wb-ads/token/status');
    return response.data;
  },

  saveToken: async (token: string) => {
    const response = await apiClient.post<WbTokenStatus & { success: boolean }>('/wb-ads/token', { token });
    return response.data;
  },

  // Sync
  syncStats: async (startDate: string, endDate: string) => {
    const response = await apiClient.post<{ synced: number; campaigns: number; message: string }>(
      '/wb-ads/sync',
      { startDate, endDate }
    );
    return response.data;
  },

  getSyncStatus: async () => {
    const response = await apiClient.get<WbAdSyncStatus>('/wb-ads/sync-status');
    return response.data;
  },

  // Analytics
  getAnalytics: async (params: { startDate: string; endDate: string; nmId?: number }) => {
    const response = await apiClient.get<WbAdAnalytics>('/wb-ads/analytics', { params });
    return response.data;
  },

  getArticles: async () => {
    const response = await apiClient.get<WbAdArticle[]>('/wb-ads/articles');
    return response.data;
  },

  // Notes
  getNotes: async (params: { startDate: string; endDate: string }) => {
    const response = await apiClient.get<WbAdNote[]>('/wb-ads/notes', { params });
    return response.data;
  },

  createNote: async (data: { date: string; content: string }) => {
    const response = await apiClient.post<WbAdNote>('/wb-ads/notes', data);
    return response.data;
  },

  updateNote: async (id: string, content: string) => {
    const response = await apiClient.put<WbAdNote>(`/wb-ads/notes/${id}`, { content });
    return response.data;
  },

  deleteNote: async (id: string) => {
    const response = await apiClient.delete(`/wb-ads/notes/${id}`);
    return response.data;
  },
};
