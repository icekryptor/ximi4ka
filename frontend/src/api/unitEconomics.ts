import { apiClient } from './client';
import { Kit } from './kits';

// Types
export interface VariableBlock {
  type: string;
  label: string;
  value_type: 'fixed' | 'percent';
  value: number;
}

export type CostType = 'estimated' | 'actual';

export interface UnitEconomicsCalculation {
  id: string;
  kit_id: string;
  kit?: Kit;
  name: string;
  channel_name: string;
  seller_price: number;
  start_price?: number | null;
  seller_discount?: number | null;
  cost_type: CostType;
  tax_rate: number;
  variable_blocks: VariableBlock[];
  cost_price: number;
  tax_amount: number;
  total_expenses: number;
  profit: number;
  margin: number;
  created_at: string;
  updated_at: string;
}

// Channel configuration (local state, not saved)
export interface ChannelConfig {
  channel_name: string;
  seller_price: number;
  start_price?: number;
  seller_discount?: number;
  cost_type: CostType;
  tax_rate: number;
  variable_blocks: VariableBlock[];
}

// Presets
export const CHANNEL_PRESETS = ['ВБ', 'Озон', 'Сайт', 'Оптовые продажи'];

export const VARIABLE_BLOCK_OPTIONS: Array<{ type: string; label: string; default_value_type: 'fixed' | 'percent' }> = [
  { type: 'commission', label: 'Комиссия площадки', default_value_type: 'percent' },
  { type: 'logistics', label: 'Стоимость логистики', default_value_type: 'fixed' },
  { type: 'storage', label: 'Хранение', default_value_type: 'fixed' },
  { type: 'advertising', label: 'Доля рекламных расходов', default_value_type: 'percent' },
  { type: 'acquiring', label: 'Эквайринг', default_value_type: 'percent' },
  { type: 'credit_commission', label: 'Комиссия за кредит', default_value_type: 'percent' },
];

// Client-side calculation (same as backend)
export function calculateUnitEconomics(
  sellerPrice: number,
  costPrice: number,
  taxRate: number,
  variableBlocks: VariableBlock[]
) {
  const taxAmount = sellerPrice * taxRate / 100;
  const variableTotal = variableBlocks.reduce((sum, block) => {
    if (block.value_type === 'percent') {
      return sum + sellerPrice * block.value / 100;
    }
    return sum + block.value;
  }, 0);
  const totalExpenses = costPrice + taxAmount + variableTotal;
  const profit = sellerPrice - totalExpenses;
  const margin = sellerPrice > 0 ? (profit / sellerPrice) * 100 : 0;

  return {
    taxAmount: Math.round(taxAmount * 100) / 100,
    variableTotal: Math.round(variableTotal * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    margin: Math.round(margin * 100) / 100,
  };
}

// Check if channel uses WB pricing model (start_price × discount)
export const isWbChannel = (channelName: string) => channelName === 'ВБ';

// Compute seller_price from start_price and seller_discount
export function computeSellerPrice(startPrice: number, sellerDiscount: number): number {
  return Math.round(startPrice * (1 - sellerDiscount / 100) * 100) / 100;
}

export function createDefaultChannel(channelName: string): ChannelConfig {
  return {
    channel_name: channelName,
    seller_price: 0,
    ...(isWbChannel(channelName) && { start_price: 0, seller_discount: 0 }),
    cost_type: 'estimated',
    tax_rate: 0,
    variable_blocks: [],
  };
}

// API
export const unitEconomicsApi = {
  getAll: async (kitId?: string) => {
    const params = kitId ? { kit_id: kitId } : {};
    const response = await apiClient.get<UnitEconomicsCalculation[]>('/unit-economics', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<UnitEconomicsCalculation>(`/unit-economics/${id}`);
    return response.data;
  },

  save: async (data: {
    kit_id: string;
    name: string;
    channel_name: string;
    seller_price: number;
    start_price?: number;
    seller_discount?: number;
    cost_type: CostType;
    tax_rate: number;
    variable_blocks: VariableBlock[];
  }) => {
    const response = await apiClient.post<UnitEconomicsCalculation>('/unit-economics', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    name: string;
    channel_name: string;
    seller_price: number;
    start_price?: number;
    seller_discount?: number;
    cost_type: CostType;
    tax_rate: number;
    variable_blocks: VariableBlock[];
  }>) => {
    const response = await apiClient.put<UnitEconomicsCalculation>(`/unit-economics/${id}`, data);
    return response.data;
  },

  clone: async (id: string, name?: string) => {
    const response = await apiClient.post<UnitEconomicsCalculation>(`/unit-economics/${id}/clone`, { name });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/unit-economics/${id}`);
    return response.data;
  },
};
