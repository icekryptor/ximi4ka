import { apiClient } from './client';
import { Transaction } from './types';

export interface ParsedTransactionRow {
  row: number;
  type: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  category_name: string;
  counterparty_id: string | null;
  counterparty_name: string;
  document_number: string | null;
  notes: string | null;
  is_duplicate: boolean;
}

export interface ImportPreview {
  parsed: ParsedTransactionRow[];
  duplicates: number;
  newRows: number;
  errors: string[];
  total: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export const transactionsApi = {
  getAll: async (params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    counterpartyId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Transaction>> => {
    const response = await apiClient.get<Transaction[]>('/transactions', { params });
    const pagination: PaginationMeta = {
      total: parseInt(response.headers['x-total-count'] || '0', 10),
      page: parseInt(response.headers['x-page'] || '1', 10),
      limit: parseInt(response.headers['x-limit'] || '100', 10),
      totalPages: parseInt(response.headers['x-total-pages'] || '1', 10),
    };
    return { data: response.data, pagination };
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

  // Export
  exportXlsx: async (params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    counterpartyId?: string;
  }) => {
    const response = await apiClient.get('/transactions/export', {
      params,
      responseType: 'blob',
    });
    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'transactions.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Import preview
  importXlsx: async (file: File): Promise<ImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ImportPreview>('/transactions/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Import confirm
  confirmImport: async (rows: ParsedTransactionRow[]): Promise<{ imported: number }> => {
    const response = await apiClient.post<{ imported: number }>('/transactions/import/confirm', { rows });
    return response.data;
  },
};
