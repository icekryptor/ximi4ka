import { apiClient } from './client';

export interface Employee {
  id: string;
  name: string;
  phone: string | null;
  telegram: string | null;
  photo_url: string | null;
  passport_data: string | null;
  hourly_rate: number;
  position: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const employeesApi = {
  getAll: async () => {
    const response = await apiClient.get<Employee[]>('/employees');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<Employee>(`/employees/${id}`);
    return response.data;
  },

  create: async (data: FormData) => {
    const response = await apiClient.post<Employee>('/employees', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  update: async (id: string, data: FormData) => {
    const response = await apiClient.put<Employee>(`/employees/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/employees/${id}`);
    return response.data;
  },
};
