import { apiClient } from './client';

export interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const boardsApi = {
  getAll: async () => {
    const response = await apiClient.get<Board[]>('/boards');
    return response.data;
  },
  create: async (data: { name: string; description?: string; color?: string }) => {
    const response = await apiClient.post<Board>('/boards', data);
    return response.data;
  },
  update: async (id: string, data: Partial<{ name: string; description: string; color: string }>) => {
    const response = await apiClient.put<Board>(`/boards/${id}`, data);
    return response.data;
  },
  archive: async (id: string) => {
    await apiClient.delete(`/boards/${id}`);
  },
};
