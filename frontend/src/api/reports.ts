import { apiClient } from './client';
import { FinancialSummary, CategoryReport, CounterpartyReport } from './types';

export const reportsApi = {
  getSummary: async (params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await apiClient.get<FinancialSummary>('/reports/summary', { params });
    return response.data;
  },

  getByCategory: async (params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }) => {
    const response = await apiClient.get<CategoryReport[]>('/reports/by-category', { params });
    return response.data;
  },

  getByCounterparty: async (params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }) => {
    const response = await apiClient.get<CounterpartyReport[]>('/reports/by-counterparty', { params });
    return response.data;
  },
};
