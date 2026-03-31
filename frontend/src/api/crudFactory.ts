import { apiClient } from './client';

export interface CrudApi<T> {
  getAll: (params?: Record<string, unknown>) => Promise<T[]>;
  getById: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

export function createCrudApi<T>(endpoint: string): CrudApi<T> {
  return {
    getAll: async (params) => {
      const response = await apiClient.get<T[]>(endpoint, { params });
      return response.data;
    },
    getById: async (id) => {
      const response = await apiClient.get<T>(`${endpoint}/${id}`);
      return response.data;
    },
    create: async (data) => {
      const response = await apiClient.post<T>(endpoint, data);
      return response.data;
    },
    update: async (id, data) => {
      const response = await apiClient.put<T>(`${endpoint}/${id}`, data);
      return response.data;
    },
    delete: async (id) => {
      await apiClient.delete(`${endpoint}/${id}`);
    },
  };
}
