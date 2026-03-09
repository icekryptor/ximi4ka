import { apiClient } from './client';
import { Kit } from './kits';
import { Employee } from './employees';

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
  checklist_id: string;
  checklist?: QcChecklist;
  inspector_id: string;
  inspector?: Employee;
  result: InspectionResult;
  item_results: ItemResult[];
  defect_photos?: string[];
  notes?: string;
  inspected_at: string;
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
  stats: async () => {
    const response = await apiClient.get<QcStats>('/qc/stats');
    return response.data;
  },
};
