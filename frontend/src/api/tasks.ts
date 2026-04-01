import { apiClient } from './client';
import { Employee } from './employees';

export type TaskColumn = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskTag {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskItem {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  column: TaskColumn;
  priority: TaskPriority;
  assignee_id: string | null;
  assignee: Employee | null;
  supervisor_id: string | null;
  supervisor: Employee | null;
  due_date: string | null;
  sort_order: number;
  created_by: string;
  tags: TaskTag[];
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  text: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export const COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: 'Бэклог',
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Готово',
};

export const COLUMN_COLORS: Record<TaskColumn, string> = {
  backlog: '#94a3b8',
  todo: '#38bdf8',
  in_progress: '#f59e0b',
  review: '#a78bfa',
  done: '#22c55e',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export const COLUMNS: TaskColumn[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

export const tasksApi = {
  getAll: async (boardId: string) => {
    const response = await apiClient.get<TaskItem[]>(`/boards/${boardId}/tasks`);
    return response.data;
  },
  create: async (boardId: string, data: {
    title: string;
    description?: string;
    column?: TaskColumn;
    priority?: TaskPriority;
    assignee_id?: string;
    supervisor_id?: string;
    due_date?: string;
    tag_ids?: string[];
  }) => {
    const response = await apiClient.post<TaskItem>(`/boards/${boardId}/tasks`, data);
    return response.data;
  },
  update: async (boardId: string, id: string, data: Partial<{
    title: string;
    description: string;
    column: TaskColumn;
    priority: TaskPriority;
    assignee_id: string | null;
    supervisor_id: string | null;
    due_date: string | null;
    tag_ids: string[];
  }>) => {
    const response = await apiClient.put<TaskItem>(`/boards/${boardId}/tasks/${id}`, data);
    return response.data;
  },
  move: async (boardId: string, id: string, data: { column: TaskColumn; sort_order: number }) => {
    const response = await apiClient.patch(`/boards/${boardId}/tasks/${id}/move`, data);
    return response.data;
  },
  delete: async (boardId: string, id: string) => {
    await apiClient.delete(`/boards/${boardId}/tasks/${id}`);
  },
};

export const tagsApi = {
  getAll: async (boardId: string) => {
    const response = await apiClient.get<TaskTag[]>(`/boards/${boardId}/tags`);
    return response.data;
  },
  create: async (boardId: string, data: { name: string; color: string }) => {
    const response = await apiClient.post<TaskTag>(`/boards/${boardId}/tags`, data);
    return response.data;
  },
  delete: async (boardId: string, id: string) => {
    await apiClient.delete(`/boards/${boardId}/tags/${id}`);
  },
};

export const commentsApi = {
  getAll: async (taskId: string) => {
    const response = await apiClient.get<TaskComment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },
  create: async (taskId: string, text: string, file?: File) => {
    const formData = new FormData();
    formData.append('text', text);
    if (file) formData.append('file', file);
    const response = await apiClient.post<TaskComment>(`/tasks/${taskId}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (taskId: string, id: string) => {
    await apiClient.delete(`/tasks/${taskId}/comments/${id}`);
  },
};
