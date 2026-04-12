import { eventBus, TaskEvent, TaskStatusEvent, TaskCommentEvent, MemberEvent } from './event-bus'
import { getChatIdForProject, sendMessage, erpLink } from './telegram.service'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const priorityIcon: Record<string, string> = { high: '🔴 Высокий', medium: '🟡 Средний', low: '🟢 Низкий' }

const columnLabels: Record<string, string> = {
  backlog: 'Бэклог', todo: 'К выполнению', in_progress: 'В работе',
  review: 'На ревью', done: 'Готово',
}

async function notify(projectId: string, text: string): Promise<void> {
  const chatId = await getChatIdForProject(projectId)
  if (!chatId) return
  await sendMessage(chatId, text)
}

export function initTelegramListener(): void {
  eventBus.onEvent('task.assigned', (data: TaskEvent) => {
    const assignee = escapeHtml(data.assigneeName || 'Не указан')
    const priority = data.priority ? (priorityIcon[data.priority] || escapeHtml(data.priority)) : 'Не указан'
    const deadline = data.dueDate ? escapeHtml(data.dueDate) : 'Не указан'
    const lines = [
      `📋 <b>Задача назначена</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Задача: ${escapeHtml(data.taskTitle)}`,
      `Исполнитель: ${assignee}`,
      `Приоритет: ${priority}`,
      `Дедлайн: ${deadline}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  eventBus.onEvent('task.completed', (data: TaskEvent) => {
    const assignee = data.assigneeName ? escapeHtml(data.assigneeName) : 'Не указан'
    const lines = [
      `✅ <b>Задача завершена</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Задача: ${escapeHtml(data.taskTitle)}`,
      `Исполнитель: ${assignee}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  eventBus.onEvent('task.status_changed', (data: TaskStatusEvent) => {
    const oldLabel = columnLabels[data.oldColumn] || escapeHtml(data.oldColumn)
    const newLabel = columnLabels[data.newColumn] || escapeHtml(data.newColumn)
    const lines = [
      `🔄 <b>Статус изменён</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Задача: ${escapeHtml(data.taskTitle)}`,
      `Статус: <s>${oldLabel}</s> → ${newLabel}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  eventBus.onEvent('task.comment_added', (data: TaskCommentEvent) => {
    const preview = data.text.length > 200
      ? escapeHtml(data.text.slice(0, 200)) + '…'
      : escapeHtml(data.text)
    const lines = [
      `💬 <b>Новый комментарий</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Задача: ${escapeHtml(data.taskTitle)}`,
      `Текст: ${preview}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  eventBus.onEvent('task.deadline_approaching', (data: TaskEvent) => {
    const assignee = data.assigneeName ? escapeHtml(data.assigneeName) : 'Не указан'
    const deadline = data.dueDate ? escapeHtml(data.dueDate) : ''
    const lines = [
      `⏰ <b>Дедлайн завтра</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Задача: ${escapeHtml(data.taskTitle)}`,
      `Исполнитель: ${assignee}`,
      `Дата: ${deadline}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  eventBus.onEvent('project.member_added', (data: MemberEvent) => {
    const role = data.role ? escapeHtml(data.role) : 'Участник'
    const lines = [
      `👋 <b>Новый участник</b>`,
      `Проект: <b>${escapeHtml(data.projectName)}</b>`,
      `Сотрудник: ${escapeHtml(data.employeeName)}`,
      `Роль: ${role}`,
      erpLink(data.projectId),
    ]
    notify(data.projectId, lines.join('\n')).catch(console.error)
  })

  console.log('✅ Telegram notification listener initialized')
}
