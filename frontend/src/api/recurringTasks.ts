import { apiClient as api } from './client'

export interface RecurringTask {
  id: string
  department_id: string
  title: string
  instruction: string | null
  frequency: string
  frequency_days: number[] | null
  assignee_id: string | null
  assignee: { id: string; name: string } | null
  department: { id: string; name: string; color: string } | null
  is_active: boolean
  created_at: string
  is_due_today: boolean
  today_report: RecurringTaskReport | null
}

export interface RecurringTaskDetail extends RecurringTask {
  reports: RecurringTaskReport[]
}

export interface RecurringTaskReport {
  id: string
  recurring_task_id: string
  author_id: string
  author: { id: string; name: string; email: string } | null
  report_date: string
  text: string
  created_at: string
}

export interface RecurringTaskCreate {
  department_id: string
  title: string
  instruction?: string
  frequency: string
  frequency_days?: number[]
  assignee_id?: string
}

export const recurringTasksApi = {
  getAll: async (departmentId?: string): Promise<RecurringTask[]> => {
    const params = departmentId ? { department_id: departmentId } : {}
    const { data } = await api.get('/recurring-tasks', { params })
    return data
  },

  getOne: async (id: string): Promise<RecurringTaskDetail> => {
    const { data } = await api.get(`/recurring-tasks/${id}`)
    return data
  },

  create: async (payload: RecurringTaskCreate): Promise<RecurringTask> => {
    const { data } = await api.post('/recurring-tasks', payload)
    return data
  },

  update: async (id: string, payload: Partial<RecurringTaskCreate & { is_active: boolean }>): Promise<RecurringTask> => {
    const { data } = await api.put(`/recurring-tasks/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/recurring-tasks/${id}`)
  },

  submitReport: async (id: string, text: string, reportDate?: string): Promise<RecurringTaskReport> => {
    const { data } = await api.post(`/recurring-tasks/${id}/reports`, { text, report_date: reportDate })
    return data
  },

  getReports: async (id: string): Promise<RecurringTaskReport[]> => {
    const { data } = await api.get(`/recurring-tasks/${id}/reports`)
    return data
  },
}
