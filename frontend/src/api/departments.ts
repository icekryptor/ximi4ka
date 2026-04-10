import { apiClient as api } from './client'

export interface Department {
  id: string
  name: string
  color: string | null
  sort_order: number
  created_at: string
  board_count: number
  member_count: number
  project_count: number
  recurring_task_count: number
}

export interface DepartmentDetail extends Department {
  boards: Array<{
    id: string
    name: string
    color: string | null
    sort_order: number
  }>
  members: DepartmentMember[]
}

export interface DepartmentMember {
  id: string
  user_id: string
  department_id: string
  role: string
  created_at: string
  user: {
    id: string
    name: string
    email: string
  }
}

export const departmentsApi = {
  getAll: async (): Promise<Department[]> => {
    const { data } = await api.get('/departments')
    return data
  },

  getOne: async (id: string): Promise<DepartmentDetail> => {
    const { data } = await api.get(`/departments/${id}`)
    return data
  },

  getMembers: async (id: string): Promise<DepartmentMember[]> => {
    const { data } = await api.get(`/departments/${id}/members`)
    return data
  },

  addMember: async (id: string, userId: string, role: string): Promise<DepartmentMember> => {
    const { data } = await api.post(`/departments/${id}/members`, { user_id: userId, role })
    return data
  },

  removeMember: async (departmentId: string, userId: string): Promise<void> => {
    await api.delete(`/departments/${departmentId}/members/${userId}`)
  },

  assignBoard: async (departmentId: string, boardId: string): Promise<void> => {
    await api.post(`/departments/${departmentId}/assign-board`, { board_id: boardId })
  },
}
