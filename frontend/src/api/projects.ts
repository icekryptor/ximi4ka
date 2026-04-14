import { apiClient as api } from './client'

export interface Project {
  id: string
  department_id: string
  name: string
  description: string | null
  budget: number
  start_date: string | null
  end_date: string | null
  deliverables: string | null
  status: string
  color: string | null
  responsible_id: string | null
  responsible: { id: string; name: string } | null
  created_by: string
  created_at: string
  updated_at: string
  department: { id: string; name: string; color: string } | null
  task_count: number
  avg_progress: number
}

export interface ChecklistItem {
  id: string
  task_id: string
  title: string
  is_checked: boolean
  sort_order: number
  created_at: string
}

export interface TaskCommentItem {
  id: string
  task_id: string
  author_id: string
  text: string
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
}

export interface ProjectTask {
  id: string
  project_id: string
  board_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  column: string
  priority: string
  assignee_id: string | null
  assignee: { id: string; name: string } | null
  start_date: string | null
  due_date: string | null
  progress: number
  sort_order: number
  created_at: string
  checklist?: ChecklistItem[]
}

export interface TaskDependency {
  id: string
  predecessor_id: string
  successor_id: string
  type: string
  is_blocking: boolean
}

export interface ProjectMember {
  id: string
  project_id: string
  employee_id: string
  employee: { id: string; name: string }
  role: string | null
  created_at: string
}

export interface TelegramChatSettings {
  id?: string
  project_id?: string
  chat_id?: string
  chat_title?: string
  digest_cron: string
  digest_enabled: boolean
  notifications_enabled: boolean
  linked?: boolean
}

export interface ProjectDetail extends Project {
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
  members?: ProjectMember[]
}

export interface ProjectCreate {
  department_id: string
  name: string
  description?: string
  budget?: number
  start_date?: string
  end_date?: string
  deliverables?: string
  status?: string
  responsible_id?: string
  color?: string | null
}

export const projectsApi = {
  getAll: async (departmentId?: string, status?: string): Promise<Project[]> => {
    const params: any = {}
    if (departmentId) params.department_id = departmentId
    if (status) params.status = status
    const { data } = await api.get('/projects', { params })
    return data
  },

  getOne: async (id: string): Promise<ProjectDetail> => {
    const { data } = await api.get(`/projects/${id}`)
    return data
  },

  create: async (payload: ProjectCreate): Promise<Project> => {
    const { data } = await api.post('/projects', payload)
    return data
  },

  update: async (id: string, payload: Partial<ProjectCreate>): Promise<Project> => {
    const { data } = await api.put(`/projects/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },

  addTask: async (projectId: string, payload: {
    title: string
    description?: string
    assignee_id?: string
    start_date?: string
    due_date?: string
    parent_id?: string
    priority?: string
    board_id?: string
  }): Promise<ProjectTask> => {
    const { data } = await api.post(`/projects/${projectId}/tasks`, payload)
    return data
  },

  updateTask: async (projectId: string, taskId: string, payload: Partial<{
    title: string
    description: string
    assignee_id: string
    start_date: string
    due_date: string
    progress: number
    parent_id: string
    column: string
    priority: string
  }>): Promise<ProjectTask> => {
    const { data } = await api.put(`/projects/${projectId}/tasks/${taskId}`, payload)
    return data
  },

  addDependency: async (projectId: string, predecessorId: string, successorId: string, isBlocking: boolean): Promise<TaskDependency> => {
    const { data } = await api.post(`/projects/${projectId}/dependencies`, {
      predecessor_id: predecessorId,
      successor_id: successorId,
      is_blocking: isBlocking,
    })
    return data
  },

  removeDependency: async (projectId: string, depId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/dependencies/${depId}`)
  },

  exportProject: async (id: string): Promise<void> => {
    const { data } = await api.get(`/projects/${id}/export`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.name || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  downloadTemplate: async (): Promise<void> => {
    const { data } = await api.get('/projects/template')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project_template.json'
    a.click()
    URL.revokeObjectURL(url)
  },

  importProject: async (departmentId: string, jsonData: any): Promise<{ id: string }> => {
    const { data } = await api.post('/projects/import', {
      department_id: departmentId,
      data: jsonData,
    })
    return data
  },

  // Checklist
  addChecklistItem: async (projectId: string, taskId: string, title: string): Promise<ChecklistItem> => {
    const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/checklist`, { title })
    return data
  },
  updateChecklistItem: async (projectId: string, taskId: string, itemId: string, payload: Partial<{ title: string; is_checked: boolean }>): Promise<ChecklistItem> => {
    const { data } = await api.put(`/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, payload)
    return data
  },
  deleteChecklistItem: async (projectId: string, taskId: string, itemId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`)
  },

  // Comments
  getComments: async (projectId: string, taskId: string): Promise<TaskCommentItem[]> => {
    const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`)
    return data
  },
  addComment: async (projectId: string, taskId: string, payload: { text: string; attachment_url?: string; attachment_name?: string }): Promise<TaskCommentItem> => {
    const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, payload)
    return data
  },
  deleteComment: async (projectId: string, taskId: string, commentId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`)
  },

  // Members
  getMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const { data } = await api.get(`/projects/${projectId}/members`)
    return data
  },
  addMember: async (projectId: string, employeeId: string, role?: string): Promise<ProjectMember> => {
    const { data } = await api.post(`/projects/${projectId}/members`, { employee_id: employeeId, role })
    return data
  },
  removeMember: async (projectId: string, memberId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/members/${memberId}`)
  },

  // Telegram
  getTelegramSettings: (projectId: string) =>
    api.get<TelegramChatSettings>(`/projects/${projectId}/telegram`).then(r => r.data),

  updateTelegramSettings: (projectId: string, data: Partial<TelegramChatSettings>) =>
    api.put<TelegramChatSettings>(`/projects/${projectId}/telegram`, data).then(r => r.data),

  unlinkTelegram: (projectId: string) =>
    api.delete(`/projects/${projectId}/telegram`).then(r => r.data),

  sendTelegramTest: (projectId: string) =>
    api.post(`/projects/${projectId}/telegram/test`).then(r => r.data),
}
