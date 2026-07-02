import { apiClient } from './client'

// ─── Типы схемы сборки ───────────────────────────────────────────────────────

export interface AssemblyRoot {
  id: string
  name: string
}

// Сырая операция (snake_case — как хранится и возвращается CRUD-эндпоинтами)
export interface AssemblyOperation {
  id: string
  composite_id: string
  name: string
  stage: number
  time_seconds: number | null
  instruction_slug: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// Операция внутри дерева (camelCase, laborCost посчитан на бэкенде)
export interface AssemblyNodeOperation {
  id: string
  name: string
  stage: number
  timeSeconds: number | null
  laborCost: number
  instructionSlug: string | null
}

export interface AssemblyNode {
  id: string
  name: string
  isComposite: boolean
  stageMax: number
  materialCost: number
  laborCost: number
  totalCost: number
  quantity: number
  operations: AssemblyNodeOperation[]
  children: AssemblyNode[]
}

export interface AssemblyTreeResponse {
  tree: AssemblyNode | null
  meta: {
    laborRate: number
    warnings: string[]
  }
}

export interface OperationCreatePayload {
  composite_id: string
  name: string
  stage?: number
  time_seconds?: number | null
  instruction_slug?: string | null
  sort_order?: number
}

export type OperationUpdatePayload = Partial<Omit<OperationCreatePayload, 'composite_id'>>

// ─── API ─────────────────────────────────────────────────────────────────────

export const assemblyApi = {
  roots: async (): Promise<AssemblyRoot[]> => {
    const res = await apiClient.get<AssemblyRoot[]>('/assembly/roots')
    return res.data
  },

  tree: async (rootId: string): Promise<AssemblyTreeResponse> => {
    const res = await apiClient.get<AssemblyTreeResponse>('/assembly/tree', { params: { root: rootId } })
    return res.data
  },

  createOperation: async (payload: OperationCreatePayload): Promise<AssemblyOperation> => {
    const res = await apiClient.post<AssemblyOperation>('/assembly/operations', payload)
    return res.data
  },

  updateOperation: async (id: string, payload: OperationUpdatePayload): Promise<AssemblyOperation> => {
    const res = await apiClient.put<AssemblyOperation>(`/assembly/operations/${id}`, payload)
    return res.data
  },

  deleteOperation: async (id: string): Promise<void> => {
    await apiClient.delete(`/assembly/operations/${id}`)
  },

  getLaborRate: async (): Promise<number> => {
    const res = await apiClient.get<{ rate: number }>('/assembly/settings/labor-rate')
    return res.data.rate
  },

  setLaborRate: async (rate: number): Promise<number> => {
    const res = await apiClient.put<{ rate: number }>('/assembly/settings/labor-rate', { rate })
    return res.data.rate
  },
}

// Формат денег для страницы сборки (везде 2 знака)
export const fmtRub = (n: number): string =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
