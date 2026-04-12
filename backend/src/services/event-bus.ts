import { EventEmitter } from 'events'

export interface TaskEvent {
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  assigneeName?: string
  priority?: string
  dueDate?: string
  progress?: number
}

export interface TaskStatusEvent extends TaskEvent {
  oldColumn: string
  newColumn: string
}

export interface TaskCommentEvent extends TaskEvent {
  authorId: string
  text: string
  attachmentUrl?: string
}

export interface MemberEvent {
  projectId: string
  projectName: string
  employeeName: string
  role?: string
}

type EventMap = {
  'task.assigned': TaskEvent
  'task.completed': TaskEvent
  'task.status_changed': TaskStatusEvent
  'task.comment_added': TaskCommentEvent
  'task.deadline_approaching': TaskEvent
  'project.member_added': MemberEvent
}

class AppEventBus extends EventEmitter {
  emitEvent<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.emit(event, data)
  }

  onEvent<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.on(event, listener)
  }
}

export const eventBus = new AppEventBus()
