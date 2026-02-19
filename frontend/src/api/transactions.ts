import { apiClient } from './client';
import { Transaction } from './types';

export const transactionsApi = {
  getAll: async (params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    counterpartyId?: string;
  }) => {
    const response = await apiClient.get<Transaction[]>('/transactions', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  create: async (data: Partial<Transaction>) => {
    const response = await apiClient.post<Transaction>('/transactions', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Transaction>) => {
    const response = await apiClient.put<Transaction>(`/transactions/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/transactions/${id}`);
    return response.data;
  },
};
