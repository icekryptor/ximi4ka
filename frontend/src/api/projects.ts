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
  created_by: string
  created_at: string
  updated_at: string
  department: { id: string; name: string; color: string } | null
  task_count: number
  avg_progress: number
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
}

export interface TaskDependency {
  id: string
  predecessor_id: string
  successor_id: string
  type: string
  is_blocking: boolean
}

export interface ProjectDetail extends Project {
  tasks: ProjectTask[]
  dependencies: TaskDependency[]
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
}
