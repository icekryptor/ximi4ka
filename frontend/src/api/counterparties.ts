import { apiClient } from './client';
import { Counterparty } from './types';

export const counterpartiesApi = {
  getAll: async (params?: {
    type?: string;
    search?: string;
    active?: boolean;
  }) => {
    const response = await apiClient.get<Counterparty[]>('/counterparties', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Counterparty>(`/counterparties/${id}`);
    return response.data;
  },

  create: async (data: Partial<Counterparty>) => {
    const response = await apiClient.post<Counterparty>('/counterparties', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Counterparty>) => {
    const response = await apiClient.put<Counterparty>(`/counterparties/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/counterparties/${id}`);
    return response.data;
  },
};
