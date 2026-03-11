import { apiClient } from './client';

export const DOC_TYPE_LABELS: Record<string, string> = {
  invoice:  'Счёт',
  waybill:  'Накладная',
  contract: 'Договор',
  other:    'Другое',
};

export interface SupplyDocument {
  id: string;
  supply_id: string;
  original_name: string;
  filename: string;
  file_url: string;
  doc_type: string;
  notes?: string;
  created_at: string;
}

export const supplyDocumentsApi = {
  getAll: async (supplyId: string) => {
    const r = await apiClient.get<SupplyDocument[]>(`/supplies/${supplyId}/documents`);
    return r.data;
  },

  upload: async (supplyId: string, files: File[], doc_type: string, notes?: string) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('doc_type', doc_type);
    if (notes) fd.append('notes', notes);
    const r = await apiClient.post<SupplyDocument[]>(
      `/supplies/${supplyId}/documents`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return r.data;
  },

  update: async (supplyId: string, docId: string, data: { doc_type?: string; notes?: string }) => {
    const r = await apiClient.put<SupplyDocument>(`/supplies/${supplyId}/documents/${docId}`, data);
    return r.data;
  },

  delete: async (supplyId: string, docId: string) => {
    await apiClient.delete(`/supplies/${supplyId}/documents/${docId}`);
  },
};
