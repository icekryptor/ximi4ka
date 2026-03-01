import { apiClient } from './client';
import { CashFlowReport, PnlReport, BalanceReport } from './types';

export const financialReportsApi = {
  getCashFlow: async (params: {
    year: number;
    period: string;
    value?: number;
  }) => {
    const response = await apiClient.get<CashFlowReport>('/financial-reports/cash-flow', { params });
    return response.data;
  },

  getPnl: async (params: {
    startDate: string;
    endDate: string;
  }) => {
    const response = await apiClient.get<PnlReport>('/financial-reports/pnl', { params });
    return response.data;
  },

  getBalance: async (params?: {
    date?: string;
  }) => {
    const response = await apiClient.get<BalanceReport>('/financial-reports/balance', { params });
    return response.data;
  },
};
