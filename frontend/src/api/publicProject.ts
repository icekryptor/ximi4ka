import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// Separate axios instance for public routes — no auth token, no 401 redirect
const publicClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Types (reuse from projects.ts where possible) ──────────────────────

export interface PublicProject {
  id: string
  name: string
  description: string | null
  budget: number
  start_date: string | null
  end_date: string | null
  deliverables: string | null
  status: string
  responsible_id: string | null
  responsible: { id: string; name: string } | null
  department: { id: string; name: string; color: string } | null
  created_at: string
  updated_at: string
  tasks: PublicTask[]
  dependencies: PublicDependency[]
  members: PublicMember[]
}

export interface PublicTask {
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
  supervisor_id: string | null
  start_date: string | null
  due_date: string | null
  progress: number
  sort_order: number
  created_at: string
  checklist: PublicChecklistItem[]
}

export interface PublicChecklistItem {
  id: string
  task_id: string
  title: string
  is_checked: boolean
  sort_order: number
}

export interface PublicDependency {
  id: string
  predecessor_id: string
  successor_id: string
  type: string
  is_blocking: boolean
}

export interface PublicMember {
  id: string
  project_id: string
  employee_id: string
  employee: { id: string; name: string }
  role: string | null
  created_at: string
}

export interface PublicComment {
  id: string
  task_id: string
  author_id: string
  text: string
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
}

// ── API ────────────────────────────────────────────────────────────────

function withToken(token: string) {
  return { params: { token } }
}

export const publicProjectApi = {
  // GET project data
  getProject(projectId: string, token: string): Promise<PublicProject> {
    return publicClient.get(`/public/projects/${projectId}`, withToken(token)).then(r => r.data)
  },

  // UPDATE project (responsible only)
  updateProject(projectId: string, token: string, data: Partial<PublicProject>): Promise<PublicProject> {
    return publicClient.put(`/public/projects/${projectId}`, data, withToken(token)).then(r => r.data)
  },

  // ADD task (responsible only)
  addTask(projectId: string, token: string, data: {
    title: string; description?: string; assignee_id?: string;
    start_date?: string; due_date?: string; priority?: string; parent_id?: string;
  }): Promise<PublicTask> {
    return publicClient.post(`/public/projects/${projectId}/tasks`, data, withToken(token)).then(r => r.data)
  },

  // UPDATE task
  updateTask(projectId: string, taskId: string, token: string, data: Partial<PublicTask>): Promise<PublicTask> {
    return publicClient.patch(`/public/projects/${projectId}/tasks/${taskId}`, data, withToken(token)).then(r => r.data)
  },

  // GET comments
  getComments(projectId: string, taskId: string, token: string): Promise<PublicComment[]> {
    return publicClient.get(`/public/projects/${projectId}/tasks/${taskId}/comments`, withToken(token)).then(r => r.data)
  },

  // ADD comment
  addComment(projectId: string, taskId: string, token: string, data: {
    text: string; attachment_url?: string; attachment_name?: string;
  }): Promise<PublicComment> {
    return publicClient.post(`/public/projects/${projectId}/tasks/${taskId}/comments`, data, withToken(token)).then(r => r.data)
  },

  // UPDATE checklist item
  updateChecklistItem(projectId: string, taskId: string, itemId: string, token: string, data: {
    is_checked?: boolean; title?: string;
  }): Promise<PublicChecklistItem> {
    return publicClient.patch(`/public/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`, data, withToken(token)).then(r => r.data)
  },

  // ADD member (responsible only)
  addMember(projectId: string, token: string, employeeId: string, role?: string): Promise<PublicMember> {
    return publicClient.post(`/public/projects/${projectId}/members`, { employee_id: employeeId, role }, withToken(token)).then(r => r.data)
  },

  // REMOVE member (responsible only)
  removeMember(projectId: string, memberId: string, token: string): Promise<void> {
    return publicClient.delete(`/public/projects/${projectId}/members/${memberId}`, withToken(token)).then(() => {})
  },
}
