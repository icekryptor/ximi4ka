import { apiClient } from './client';
import { Category } from './types';

export const categoriesApi = {
  getAll: async (params?: {
    type?: string;
    active?: boolean;
  }) => {
    const response = await apiClient.get<Category[]>('/categories', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Category>(`/categories/${id}`);
    return response.data;
  },

  create: async (data: Partial<Category>) => {
    const response = await apiClient.post<Category>('/categories', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Category>) => {
    const response = await apiClient.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/categories/${id}`);
    return response.data;
  },
};
