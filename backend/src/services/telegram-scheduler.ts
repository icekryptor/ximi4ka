import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { AppDataSource } from '../config/database'
import { TelegramChat } from '../entities/TelegramChat'
import { Task, TaskColumn } from '../entities/Task'
import { eventBus } from './event-bus'

// Lazy import to avoid circular dependency — telegram.service.ts may not exist yet
const getSendDigest = async () => {
  const mod = await import('./telegram.service')
  return mod.sendDigestForProject
}

/** Map of project_id -> scheduled cron job */
const jobs = new Map<string, ScheduledTask>()

/**
 * Загрузить все TelegramChat с digest_enabled=true и запустить cron-задачи.
 * Также запускает ежедневную проверку дедлайнов в 9:00.
 */
export async function initDigestScheduler(): Promise<void> {
  const repo = AppDataSource.getRepository(TelegramChat)
  const chats = await repo.find({ where: { digest_enabled: true } })

  for (const chat of chats) {
    scheduleDigest(chat)
  }

  // Ежедневная проверка дедлайнов в 9:00
  cron.schedule('0 9 * * *', () => {
    checkDeadlines().catch(err =>
      console.error('[telegram-scheduler] deadline check error:', err)
    )
  })

  console.log(
    `[telegram-scheduler] initialized: ${chats.length} digest(s), deadline check at 9:00`
  )
}

/**
 * Создать / заменить cron-задачу для конкретного чата.
 */
export function scheduleDigest(chat: TelegramChat): void {
  if (!cron.validate(chat.digest_cron)) {
    console.warn(
      `[telegram-scheduler] invalid cron "${chat.digest_cron}" for project ${chat.project_id}, skipping`
    )
    return
  }

  // Остановить старую задачу, если есть
  const existing = jobs.get(chat.project_id)
  if (existing) {
    existing.stop()
  }

  const job = cron.schedule(chat.digest_cron, async () => {
    try {
      const sendDigest = await getSendDigest()
      await sendDigest(chat.project_id, chat.chat_id)
    } catch (err) {
      console.error(
        `[telegram-scheduler] digest error for project ${chat.project_id}:`,
        err
      )
    }
  })

  jobs.set(chat.project_id, job)
}

/**
 * Перечитать настройки чата из БД, остановить старую задачу и запустить новую (если включено).
 */
export async function rescheduleDigest(projectId: string): Promise<void> {
  const repo = AppDataSource.getRepository(TelegramChat)
  const chat = await repo.findOne({ where: { project_id: projectId } })

  // Остановить текущую задачу
  const existing = jobs.get(projectId)
  if (existing) {
    existing.stop()
    jobs.delete(projectId)
  }

  if (chat && chat.digest_enabled) {
    scheduleDigest(chat)
  }
}

/**
 * Остановить и удалить задачу для проекта.
 */
export function removeDigest(projectId: string): void {
  const existing = jobs.get(projectId)
  if (existing) {
    existing.stop()
    jobs.delete(projectId)
  }
}

/**
 * Найти все задачи с дедлайном = завтра, не done, прогресс < 100.
 * Для каждой — emit 'task.deadline_approaching'.
 */
export async function checkDeadlines(): Promise<void> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10) // YYYY-MM-DD

  const taskRepo = AppDataSource.getRepository(Task)
  const tasks = await taskRepo.find({
    where: {
      due_date: tomorrowStr,
    },
    relations: ['project', 'assignee'],
  })

  for (const task of tasks) {
    // Пропускаем выполненные задачи
    if (task.column === TaskColumn.DONE || task.progress >= 100) {
      continue
    }

    const projectName = task.project?.name ?? 'Неизвестный проект'

    eventBus.emitEvent('task.deadline_approaching', {
      projectId: task.project_id ?? '',
      projectName,
      taskId: task.id,
      taskTitle: task.title,
      assigneeName: task.assignee?.name,
      priority: task.priority,
      dueDate: task.due_date,
      progress: task.progress,
    })
  }

  if (tasks.length > 0) {
    console.log(
      `[telegram-scheduler] deadline check: found ${tasks.length} task(s) due tomorrow`
    )
  }
}
