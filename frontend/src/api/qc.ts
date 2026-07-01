import { apiClient } from './client';
import { Kit } from './kits';
import { Employee } from './employees';
import { ProductionOrder } from './orders';

export interface ChecklistItem {
  id: string;
  text: string;
  category?: string;
}

export interface QcChecklist {
  id: string;
  kit_id: string;
  kit?: Kit;
  name: string;
  version: number;
  items: ChecklistItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export enum InspectionResult {
  PASS = 'pass',
  FAIL = 'fail',
  CONDITIONAL = 'conditional',
}

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  [InspectionResult.PASS]: 'Годен',
  [InspectionResult.FAIL]: 'Брак',
  [InspectionResult.CONDITIONAL]: 'Условно годен',
};

export const INSPECTION_RESULT_COLORS: Record<InspectionResult, string> = {
  [InspectionResult.PASS]: 'bg-green-100 text-green-700',
  [InspectionResult.FAIL]: 'bg-red-100 text-red-700',
  [InspectionResult.CONDITIONAL]: 'bg-yellow-100 text-yellow-700',
};

export interface ItemResult {
  item_id: string;
  passed: boolean;
  comment?: string;
}

export interface QcInspection {
  id: string;
  order_id: string;
  order?: ProductionOrder;
  checklist_id?: string;
  checklist?: QcChecklist;
  inspector_id?: string;
  inspector?: Employee;
  inspected_qty: number;
  passed_qty: number;
  failed_qty: number;
  result: InspectionResult;
  item_results: ItemResult[];
  defect_description?: string;
  defect_photos?: string[];
  batch_number?: string;
  notes?: string;
  created_at: string;
}

export interface QcStats {
  total_inspections: number;
  pass_count: number;
  fail_count: number;
  conditional_count: number;
  pass_rate: number;
}

export const qcApi = {
  // Checklists
  getChecklists: async (params?: { kit_id?: string }) => {
    const response = await apiClient.get<QcChecklist[]>('/qc/checklists', { params });
    return response.data;
  },

  getChecklist: async (id: string) => {
    const response = await apiClient.get<QcChecklist>(`/qc/checklists/${id}`);
    return response.data;
  },

  createChecklist: async (data: Partial<QcChecklist>) => {
    const response = await apiClient.post<QcChecklist>('/qc/checklists', data);
    return response.data;
  },

  updateChecklist: async (id: string, data: Partial<QcChecklist>) => {
    const response = await apiClient.put<QcChecklist>(`/qc/checklists/${id}`, data);
    return response.data;
  },

  deleteChecklist: async (id: string) => {
    const response = await apiClient.delete(`/qc/checklists/${id}`);
    return response.data;
  },

  // Inspections
  getInspections: async (params?: { order_id?: string; result?: InspectionResult }) => {
    const response = await apiClient.get<QcInspection[]>('/qc/inspections', { params });
    return response.data;
  },

  getInspection: async (id: string) => {
    const response = await apiClient.get<QcInspection>(`/qc/inspections/${id}`);
    return response.data;
  },

  createInspection: async (data: Partial<QcInspection>) => {
    const response = await apiClient.post<QcInspection>('/qc/inspections', data);
    return response.data;
  },

  // Stats
  // Бэкенд возвращает сырые строки groupBy по result — приводим к QcStats
  stats: async (): Promise<QcStats> => {
    const response = await apiClient.get<Array<{
      result: InspectionResult;
      count: string;
      total_inspected: string | null;
      total_passed: string | null;
      total_failed: string | null;
    }>>('/qc/stats');
    const rows = response.data;
    const countByResult = (r: InspectionResult) =>
      Number(rows.find(row => row.result === r)?.count || 0);
    const pass_count = countByResult(InspectionResult.PASS);
    const fail_count = countByResult(InspectionResult.FAIL);
    const conditional_count = countByResult(InspectionResult.CONDITIONAL);
    const total_inspected = rows.reduce((sum, row) => sum + Number(row.total_inspected || 0), 0);
    const total_passed = rows.reduce((sum, row) => sum + Number(row.total_passed || 0), 0);
    return {
      total_inspections: pass_count + fail_count + conditional_count,
      pass_count,
      fail_count,
      conditional_count,
      pass_rate: total_inspected > 0 ? (total_passed / total_inspected) * 100 : 0,
    };
  },
};
