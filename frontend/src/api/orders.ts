import { apiClient } from './client';
import { Kit } from './kits';
import { SalesChannel } from './channels';

export enum OrderStatus {
  CREATED = 'created',
  IN_PRODUCTION = 'in_production',
  QC = 'qc',
  PACKING = 'packing',
  READY = 'ready',
  SHIPPED = 'shipped',
  AT_MARKETPLACE = 'at_marketplace',
  CANCELLED = 'cancelled',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'Создан',
  [OrderStatus.IN_PRODUCTION]: 'В производстве',
  [OrderStatus.QC]: 'ОТК',
  [OrderStatus.PACKING]: 'Упаковка',
  [OrderStatus.READY]: 'Готов к отгрузке',
  [OrderStatus.SHIPPED]: 'Отгружен',
  [OrderStatus.AT_MARKETPLACE]: 'На складе МП',
  [OrderStatus.CANCELLED]: 'Отменён',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'bg-gray-100 text-gray-700',
  [OrderStatus.IN_PRODUCTION]: 'bg-blue-100 text-blue-700',
  [OrderStatus.QC]: 'bg-yellow-100 text-yellow-700',
  [OrderStatus.PACKING]: 'bg-purple-100 text-purple-700',
  [OrderStatus.READY]: 'bg-green-100 text-green-700',
  [OrderStatus.SHIPPED]: 'bg-teal-100 text-teal-700',
  [OrderStatus.AT_MARKETPLACE]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
};

export interface ProductionOrder {
  id: string;
  order_number: string;
  kit_id: string;
  kit?: Kit;
  quantity: number;
  status: OrderStatus;
  channel_id?: string;
  channel?: SalesChannel;
  target_date?: string;
  completed_date?: string;
  fbo_shipment_id?: string;
  planned_cost: number;
  actual_cost?: number;
  qc_passed: number;
  qc_failed: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderStats {
  status: OrderStatus;
  count: number;
  total_quantity: number;
}

export const ordersApi = {
  getAll: async (params?: { status?: OrderStatus; kit_id?: string; channel_id?: string }) => {
    const response = await apiClient.get<ProductionOrder[]>('/orders', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<ProductionOrder>(`/orders/${id}`);
    return response.data;
  },

  create: async (data: Partial<ProductionOrder>) => {
    const response = await apiClient.post<ProductionOrder>('/orders', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ProductionOrder>) => {
    const response = await apiClient.put<ProductionOrder>(`/orders/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, status: OrderStatus) => {
    const response = await apiClient.patch<ProductionOrder>(`/orders/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/orders/${id}`);
    return response.data;
  },

  stats: async () => {
    const response = await apiClient.get<OrderStats[]>('/orders/stats');
    return response.data;
  },
};
