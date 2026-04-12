# Telegram Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Telegram bot that sends event-driven notifications to project group chats, responds to commands (/link, /status, /tasks, /digest), and posts automatic periodic digests.

**Architecture:** EventEmitter pattern — controllers emit events, TelegramNotificationListener formats and sends messages via TelegramService. Bot runs inside the existing Express server using webhook mode. Digest scheduling via node-cron.

**Tech Stack:** node-telegram-bot-api, node-cron, Node.js EventEmitter, TypeORM, Express

---

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/package.json`

**Step 1: Install packages**

Run:
```bash
cd backend && npm install node-telegram-bot-api node-cron && npm install -D @types/node-telegram-bot-api @types/node-cron
```

**Step 2: Verify installation**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -5`
Expected: No new errors

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add node-telegram-bot-api and node-cron dependencies"
```

---

### Task 2: Create TelegramChat Entity + Migration

**Files:**
- Create: `backend/src/entities/TelegramChat.ts`
- Modify: `backend/src/config/database.ts` (line ~50, add to allEntities array)

**Step 1: Create entity file**

```typescript
// backend/src/entities/TelegramChat.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Project } from './Project'

@Entity('telegram_chats')
export class TelegramChat {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ type: 'uuid', unique: true, comment: 'ID проекта (один чат на проект)' })
  project_id: string

  @Column({ type: 'bigint', comment: 'Telegram chat ID группы' })
  chat_id: string  // bigint stored as string in JS

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Название группы' })
  chat_title: string

  @Column({ type: 'varchar', length: 50, default: '0 9 * * 1', comment: 'Cron-расписание дайджеста' })
  digest_cron: string

  @Column({ type: 'boolean', default: true, comment: 'Автодайджест вкл/выкл' })
  digest_enabled: boolean

  @Column({ type: 'boolean', default: true, comment: 'Уведомления вкл/выкл' })
  notifications_enabled: boolean

  @CreateDateColumn()
  created_at: Date
}
```

**Step 2: Register entity in database.ts**

In `backend/src/config/database.ts`, add import at the top and add `TelegramChat` to the `allEntities` array (line ~50).

**Step 3: Run migration SQL on Supabase**

```sql
CREATE TABLE telegram_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  chat_title VARCHAR(255),
  digest_cron VARCHAR(50) NOT NULL DEFAULT '0 9 * * 1',
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telegram_chats_project_id ON telegram_chats(project_id);
CREATE INDEX idx_telegram_chats_chat_id ON telegram_chats(chat_id);
```

**Step 4: Verify build**

Run: `cd backend && npx tsc --noEmit`
Expected: Clean

**Step 5: Commit**

```bash
git add backend/src/entities/TelegramChat.ts backend/src/config/database.ts
git commit -m "feat: add TelegramChat entity and migration"
```

---

### Task 3: Create EventBus Singleton

**Files:**
- Create: `backend/src/services/event-bus.ts`

**Step 1: Create the event bus**

```typescript
// backend/src/services/event-bus.ts
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
```

**Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/services/event-bus.ts
git commit -m "feat: add EventBus singleton for decoupled notifications"
```

---

### Task 4: Create TelegramService (Bot API + Webhook + Commands)

**Files:**
- Create: `backend/src/services/telegram.service.ts`

**Step 1: Create the service**

```typescript
// backend/src/services/telegram.service.ts
import TelegramBot from 'node-telegram-bot-api'
import { AppDataSource } from '../config/database'
import { TelegramChat } from '../entities/TelegramChat'
import { Project } from '../entities/Project'
import { Task } from '../entities/Task'
import { In } from 'typeorm'

let bot: TelegramBot | null = null

function getBot(): TelegramBot | null {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)
  }
  return bot
}

function chatRepo() {
  return AppDataSource.getRepository(TelegramChat)
}

function projectRepo() {
  return AppDataSource.getRepository(Project)
}

function taskRepo() {
  return AppDataSource.getRepository(Task)
}

// ─── Send message ────────────────────────────────────────────────────────

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const b = getBot()
  if (!b) {
    console.warn('[Telegram] Bot token not configured, skipping message')
    return
  }
  try {
    await b.sendMessage(chatId, text, { parse_mode: 'HTML' })
  } catch (err: any) {
    console.error(`[Telegram] Failed to send to ${chatId}:`, err.message)
  }
}

// ─── Get chat_id for project ─────────────────────────────────────────────

export async function getChatIdForProject(projectId: string): Promise<string | null> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat || !chat.notifications_enabled) return null
  return chat.chat_id
}

// ─── Get chat settings ───────────────────────────────────────────────────

export async function getChatSettings(projectId: string): Promise<TelegramChat | null> {
  return chatRepo().findOne({ where: { project_id: projectId } })
}

// ─── Update chat settings ────────────────────────────────────────────────

export async function updateChatSettings(
  projectId: string,
  data: Partial<Pick<TelegramChat, 'digest_enabled' | 'digest_cron' | 'notifications_enabled'>>
): Promise<TelegramChat | null> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat) return null
  Object.assign(chat, data)
  return chatRepo().save(chat)
}

// ─── Unlink chat ─────────────────────────────────────────────────────────

export async function unlinkChat(projectId: string): Promise<boolean> {
  const result = await chatRepo().delete({ project_id: projectId })
  return (result.affected || 0) > 0
}

// ─── Send test message ───────────────────────────────────────────────────

export async function sendTestMessage(projectId: string): Promise<boolean> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat) return false
  await sendMessage(chat.chat_id, '🔔 <b>Тестовое сообщение</b>\nБот подключён и работает!')
  return true
}

// ─── Webhook handler ─────────────────────────────────────────────────────

export async function handleWebhook(body: any): Promise<void> {
  const b = getBot()
  if (!b) return

  const message = body.message
  if (!message || !message.text || !message.chat) return

  const chatId = String(message.chat.id)
  const text = message.text.trim()
  const chatTitle = message.chat.title || null

  if (text.startsWith('/link ')) {
    await handleLinkCommand(chatId, chatTitle, text)
  } else if (text === '/unlink' || text.startsWith('/unlink@')) {
    await handleUnlinkCommand(chatId)
  } else if (text === '/status' || text.startsWith('/status@')) {
    await handleStatusCommand(chatId)
  } else if (text === '/tasks' || text.startsWith('/tasks@')) {
    await handleTasksCommand(chatId)
  } else if (text === '/digest' || text.startsWith('/digest@')) {
    await handleDigestCommand(chatId)
  }
}

// ─── /link <project_id> ─────────────────────────────────────────────────

async function handleLinkCommand(chatId: string, chatTitle: string | null, text: string): Promise<void> {
  const parts = text.split(/\s+/)
  const projectId = parts[1]
  if (!projectId) {
    await sendMessage(chatId, '⚠️ Использование: <code>/link &lt;project_id&gt;</code>')
    return
  }

  const project = await projectRepo().findOne({ where: { id: projectId } })
  if (!project) {
    await sendMessage(chatId, '❌ Проект не найден. Проверьте ID.')
    return
  }

  // Upsert: update if exists, create if not
  let chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (chat) {
    chat.chat_id = chatId
    chat.chat_title = chatTitle || chat.chat_title
  } else {
    chat = chatRepo().create({
      project_id: projectId,
      chat_id: chatId,
      chat_title: chatTitle,
    })
  }
  await chatRepo().save(chat)
  await sendMessage(chatId, `✅ Чат привязан к проекту <b>${escapeHtml(project.name)}</b>`)
}

// ─── /unlink ─────────────────────────────────────────────────────────────

async function handleUnlinkCommand(chatId: string): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: chatId } })
  if (!chat) {
    await sendMessage(chatId, '⚠️ Этот чат не привязан к проекту.')
    return
  }
  await chatRepo().remove(chat)
  await sendMessage(chatId, '✅ Чат отвязан от проекта.')
}

// ─── /status ─────────────────────────────────────────────────────────────

async function handleStatusCommand(chatId: string): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: chatId } })
  if (!chat) {
    await sendMessage(chatId, '⚠️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }

  const project = await projectRepo().findOne({
    where: { id: chat.project_id },
    relations: ['responsible'],
  })
  if (!project) {
    await sendMessage(chatId, '❌ Проект не найден.')
    return
  }

  const tasks = await taskRepo().find({ where: { project_id: project.id } })
  const total = tasks.length
  const done = tasks.filter(t => t.column === 'done' || t.progress >= 100).length
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.column !== 'done' && t.progress < 100).length
  const avgProgress = total > 0 ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / total) : 0

  const highCount = tasks.filter(t => t.priority === 'high' && t.column !== 'done').length
  const medCount = tasks.filter(t => t.priority === 'medium' && t.column !== 'done').length
  const lowCount = tasks.filter(t => t.priority === 'low' && t.column !== 'done').length

  const barLen = 10
  const filled = Math.round((avgProgress / 100) * barLen)
  const bar = '▓'.repeat(filled) + '░'.repeat(barLen - filled)

  const statusMap: Record<string, string> = {
    draft: 'Черновик', active: 'Активный', on_hold: 'На паузе',
    completed: 'Завершён', cancelled: 'Отменён',
  }

  const deadline = project.end_date
    ? new Date(project.end_date).toLocaleDateString('ru-RU')
    : '—'

  const msg = [
    `📊 <b>Проект: ${escapeHtml(project.name)}</b>`,
    `Статус: ${statusMap[project.status] || project.status}`,
    `Прогресс: ${avgProgress}%`,
    bar,
    '',
    `Задачи: ${done} из ${total} завершено`,
    `🔴 Высокий: ${highCount}  🟡 Средний: ${medCount}  🟢 Низкий: ${lowCount}`,
    overdue > 0 ? `⏰ Просрочено: ${overdue}` : '',
    '',
    `Бюджет: ${Number(project.budget).toLocaleString('ru-RU')} ₽`,
    `Дедлайн: ${deadline}`,
  ].filter(Boolean).join('\n')

  await sendMessage(chatId, msg)
}

// ─── /tasks ──────────────────────────────────────────────────────────────

async function handleTasksCommand(chatId: string): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: chatId } })
  if (!chat) {
    await sendMessage(chatId, '⚠️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }

  const tasks = await taskRepo().find({
    where: { project_id: chat.project_id },
    relations: ['assignee'],
    order: { priority: 'ASC', due_date: 'ASC' },
  })

  const active = tasks.filter(t => t.column !== 'done' && t.progress < 100)

  if (active.length === 0) {
    await sendMessage(chatId, '✅ Нет активных задач!')
    return
  }

  const priorityIcon: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }

  const lines = active.slice(0, 15).map((t, i) => {
    const icon = priorityIcon[t.priority] || '🟡'
    const assignee = t.assignee ? t.assignee.name : '—'
    const due = t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—'
    return [
      `${i + 1}. <b>${escapeHtml(t.title)}</b>`,
      `   👤 ${escapeHtml(assignee)} · ${icon} · ${t.progress}%`,
      `   📅 до ${due}`,
    ].join('\n')
  })

  const header = `📋 <b>Активные задачи (${active.length}):</b>\n`
  const footer = active.length > 15 ? `\n\n... и ещё ${active.length - 15}` : ''

  await sendMessage(chatId, header + '\n' + lines.join('\n\n') + footer)
}

// ─── /digest (manual trigger) ────────────────────────────────────────────

export async function handleDigestCommand(chatId: string): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: chatId } })
  if (!chat) {
    await sendMessage(chatId, '⚠️ Чат не привязан.')
    return
  }
  await sendDigestForProject(chat.project_id, chatId)
}

// ─── Digest content ──────────────────────────────────────────────────────

export async function sendDigestForProject(projectId: string, chatId: string): Promise<void> {
  const project = await projectRepo().findOne({ where: { id: projectId } })
  if (!project) return

  const tasks = await taskRepo().find({
    where: { project_id: projectId },
    relations: ['assignee'],
  })

  const total = tasks.length
  const done = tasks.filter(t => t.column === 'done' || t.progress >= 100).length
  const avgProgress = total > 0 ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / total) : 0

  const barLen = 10
  const filled = Math.round((avgProgress / 100) * barLen)
  const bar = '▓'.repeat(filled) + '░'.repeat(barLen - filled)

  const overdue = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() && t.column !== 'done' && t.progress < 100
  )

  const upcoming = tasks.filter(t => {
    if (!t.due_date || t.column === 'done' || t.progress >= 100) return false
    const d = new Date(t.due_date)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())

  const today = new Date().toLocaleDateString('ru-RU')

  const lines = [
    `📈 <b>Сводка — ${today}</b>`,
    `Проект: <b>${escapeHtml(project.name)}</b>`,
    '',
    `Прогресс: ${avgProgress}%`,
    bar,
    `Задач завершено: ${done} из ${total}`,
  ]

  if (overdue.length > 0) {
    lines.push('', '⏰ <b>Просроченные задачи:</b>')
    overdue.slice(0, 5).forEach(t => {
      const assignee = t.assignee ? t.assignee.name : '—'
      const due = new Date(t.due_date!).toLocaleDateString('ru-RU')
      lines.push(`• ${escapeHtml(t.title)} (${escapeHtml(assignee)}, до ${due})`)
    })
  }

  if (upcoming.length > 0) {
    lines.push('', '🔜 <b>Ближайшие дедлайны:</b>')
    upcoming.slice(0, 5).forEach(t => {
      const due = new Date(t.due_date!).toLocaleDateString('ru-RU')
      lines.push(`• ${escapeHtml(t.title)} — ${due}`)
    })
  }

  await sendMessage(chatId, lines.join('\n'))
}

// ─── HTML escaping ───────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Setup webhook ───────────────────────────────────────────────────────

export function setupWebhook(baseUrl: string): void {
  const b = getBot()
  if (!b) return
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || 'default-secret'
  const webhookUrl = `${baseUrl}/api/webhooks/telegram/${secret}`
  b.setWebHook(webhookUrl).then(() => {
    console.log(`✅ Telegram webhook set: ${webhookUrl}`)
  }).catch(err => {
    console.error('[Telegram] Failed to set webhook:', err.message)
  })
}
```

**Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/services/telegram.service.ts
git commit -m "feat: add TelegramService with bot commands and webhook"
```

---

### Task 5: Create TelegramNotificationListener

**Files:**
- Create: `backend/src/services/telegram-listener.ts`

**Step 1: Create the listener**

```typescript
// backend/src/services/telegram-listener.ts
import { eventBus, TaskEvent, TaskStatusEvent, TaskCommentEvent, MemberEvent } from './event-bus'
import { getChatIdForProject, sendMessage } from './telegram.service'

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
    const due = data.dueDate ? new Date(data.dueDate).toLocaleDateString('ru-RU') : '—'
    const msg = [
      `📋 <b>Задача назначена</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Задача: <b>${escapeHtml(data.taskTitle)}</b>`,
      `Исполнитель: ${escapeHtml(data.assigneeName || '—')}`,
      `Приоритет: ${priorityIcon[data.priority || 'medium'] || '🟡 Средний'}`,
      `Срок: ${due}`,
    ].join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  eventBus.onEvent('task.completed', (data: TaskEvent) => {
    const msg = [
      `✅ <b>Задача завершена</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Задача: <b>${escapeHtml(data.taskTitle)}</b>`,
      data.assigneeName ? `Исполнитель: ${escapeHtml(data.assigneeName)}` : '',
    ].filter(Boolean).join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  eventBus.onEvent('task.status_changed', (data: TaskStatusEvent) => {
    const oldLabel = columnLabels[data.oldColumn] || data.oldColumn
    const newLabel = columnLabels[data.newColumn] || data.newColumn
    const msg = [
      `🔄 <b>Статус задачи изменён</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Задача: <b>${escapeHtml(data.taskTitle)}</b>`,
      `<s>${escapeHtml(oldLabel)}</s> → ${escapeHtml(newLabel)}`,
    ].join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  eventBus.onEvent('task.comment_added', (data: TaskCommentEvent) => {
    const preview = data.text.length > 200 ? data.text.slice(0, 200) + '...' : data.text
    const msg = [
      `💬 <b>Новый комментарий</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Задача: <b>${escapeHtml(data.taskTitle)}</b>`,
      ``,
      escapeHtml(preview),
    ].join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  eventBus.onEvent('task.deadline_approaching', (data: TaskEvent) => {
    const due = data.dueDate ? new Date(data.dueDate).toLocaleDateString('ru-RU') : '—'
    const msg = [
      `⏰ <b>Дедлайн завтра</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Задача: <b>${escapeHtml(data.taskTitle)}</b>`,
      data.assigneeName ? `Исполнитель: ${escapeHtml(data.assigneeName)}` : '',
      `Срок: ${due}`,
    ].filter(Boolean).join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  eventBus.onEvent('project.member_added', (data: MemberEvent) => {
    const msg = [
      `👋 <b>Новый участник</b>`,
      `Проект: ${escapeHtml(data.projectName)}`,
      `Сотрудник: ${escapeHtml(data.employeeName)}`,
      data.role ? `Роль: ${escapeHtml(data.role)}` : '',
    ].filter(Boolean).join('\n')
    notify(data.projectId, msg).catch(console.error)
  })

  console.log('✅ Telegram notification listener initialized')
}
```

**Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/services/telegram-listener.ts
git commit -m "feat: add TelegramNotificationListener for event-driven messages"
```

---

### Task 6: Create Digest Scheduler

**Files:**
- Create: `backend/src/services/telegram-scheduler.ts`

**Step 1: Create the scheduler**

```typescript
// backend/src/services/telegram-scheduler.ts
import cron from 'node-cron'
import { AppDataSource } from '../config/database'
import { TelegramChat } from '../entities/TelegramChat'
import { Task } from '../entities/Task'
import { sendDigestForProject, getChatIdForProject, sendMessage } from './telegram.service'
import { eventBus } from './event-bus'

const scheduledJobs = new Map<string, cron.ScheduledTask>()

// ─── Load and schedule all digests ───────────────────────────────────────

export async function initDigestScheduler(): Promise<void> {
  const repo = AppDataSource.getRepository(TelegramChat)
  const chats = await repo.find({ where: { digest_enabled: true } })

  for (const chat of chats) {
    scheduleDigest(chat)
  }

  // Deadline approaching check — every day at 9:00
  cron.schedule('0 9 * * *', () => {
    checkDeadlines().catch(console.error)
  })

  console.log(`✅ Digest scheduler initialized (${chats.length} active digests)`)
}

// ─── Schedule a single digest ────────────────────────────────────────────

export function scheduleDigest(chat: TelegramChat): void {
  // Remove existing job if any
  const existing = scheduledJobs.get(chat.project_id)
  if (existing) {
    existing.stop()
    scheduledJobs.delete(chat.project_id)
  }

  if (!chat.digest_enabled || !cron.validate(chat.digest_cron)) return

  const job = cron.schedule(chat.digest_cron, () => {
    sendDigestForProject(chat.project_id, chat.chat_id).catch(console.error)
  })

  scheduledJobs.set(chat.project_id, job)
}

// ─── Reschedule after settings update ────────────────────────────────────

export async function rescheduleDigest(projectId: string): Promise<void> {
  const repo = AppDataSource.getRepository(TelegramChat)
  const chat = await repo.findOne({ where: { project_id: projectId } })

  // Remove old job
  const existing = scheduledJobs.get(projectId)
  if (existing) {
    existing.stop()
    scheduledJobs.delete(projectId)
  }

  // Schedule new if enabled
  if (chat && chat.digest_enabled) {
    scheduleDigest(chat)
  }
}

// ─── Remove scheduled digest ─────────────────────────────────────────────

export function removeDigest(projectId: string): void {
  const existing = scheduledJobs.get(projectId)
  if (existing) {
    existing.stop()
    scheduledJobs.delete(projectId)
  }
}

// ─── Deadline check (runs daily at 9:00) ─────────────────────────────────

async function checkDeadlines(): Promise<void> {
  const taskRepo = AppDataSource.getRepository(Task)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const tasks = await taskRepo.find({
    where: { due_date: tomorrowStr },
    relations: ['assignee'],
  })

  for (const task of tasks) {
    if (!task.project_id || task.column === 'done' || task.progress >= 100) continue

    // Load project name
    const project = await AppDataSource.getRepository('Project').findOne({ where: { id: task.project_id } })
    if (!project) continue

    eventBus.emitEvent('task.deadline_approaching', {
      projectId: task.project_id,
      projectName: (project as any).name,
      taskId: task.id,
      taskTitle: task.title,
      assigneeName: task.assignee?.name,
      dueDate: task.due_date,
    })
  }
}
```

**Step 2: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/services/telegram-scheduler.ts
git commit -m "feat: add digest scheduler with daily deadline check"
```

---

### Task 7: Create Telegram Webhook Route

**Files:**
- Create: `backend/src/routes/telegram.routes.ts`
- Modify: `backend/src/server.ts` (add webhook route, init listener + scheduler)

**Step 1: Create route file**

```typescript
// backend/src/routes/telegram.routes.ts
import { Router, Request, Response } from 'express'
import { handleWebhook } from '../services/telegram.service'

const router = Router()

// Telegram webhook — secret token in URL path for verification
router.post('/:secret', async (req: Request, res: Response) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 'default-secret'
  if (req.params.secret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    await handleWebhook(req.body)
    res.sendStatus(200)
  } catch (err: any) {
    console.error('[Telegram Webhook Error]', err.message)
    res.sendStatus(200) // Always 200 to Telegram to prevent retries
  }
})

export default router
```

**Step 2: Register route + init services in server.ts**

In `backend/src/server.ts`:

1. Add import at top (with other route imports):
```typescript
import telegramRoutes from './routes/telegram.routes'
```

2. Add public route BEFORE the protected routes block (after line 101, before line 103):
```typescript
// Telegram webhook (public — verified by secret in URL)
app.use('/api/webhooks/telegram', telegramRoutes);
```

3. In the `bootstrap()` function, AFTER `app.listen(...)` (after line 166), add initialization:
```typescript
    // Initialize Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { initTelegramListener } = await import('./services/telegram-listener')
      const { initDigestScheduler } = await import('./services/telegram-scheduler')
      const { setupWebhook } = await import('./services/telegram.service')
      initTelegramListener()
      await initDigestScheduler()
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`
      setupWebhook(baseUrl)
    }
```

**Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/routes/telegram.routes.ts backend/src/server.ts
git commit -m "feat: add Telegram webhook route and init in server bootstrap"
```

---

### Task 8: Add Event Emissions to Project Controller

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

**Step 1: Add import at top of file**

```typescript
import { eventBus } from '../services/event-bus'
```

**Step 2: Add emissions to updateTask method (around line 208-231)**

After the existing `await taskRepo.save(task)` line, before `res.json(task)`, add:

```typescript
    // ── Emit events for Telegram ──
    if (task.project_id) {
      const project = await AppDataSource.getRepository(Project).findOne({ where: { id: task.project_id } })
      const projectName = project?.name || ''

      // Task assigned (assignee changed)
      if (req.body.assignee_id && req.body.assignee_id !== oldAssigneeId) {
        const assignee = task.assignee_id
          ? await AppDataSource.getRepository(Employee).findOne({ where: { id: task.assignee_id } })
          : null
        eventBus.emitEvent('task.assigned', {
          projectId: task.project_id,
          projectName,
          taskId: task.id,
          taskTitle: task.title,
          assigneeName: assignee?.name,
          priority: task.priority,
          dueDate: task.due_date,
        })
      }

      // Task completed
      if ((req.body.progress === 100 || req.body.column === 'done') && oldProgress < 100 && oldColumn !== 'done') {
        const assignee = task.assignee_id
          ? await AppDataSource.getRepository(Employee).findOne({ where: { id: task.assignee_id } })
          : null
        eventBus.emitEvent('task.completed', {
          projectId: task.project_id,
          projectName,
          taskId: task.id,
          taskTitle: task.title,
          assigneeName: assignee?.name,
        })
      }

      // Status changed (column changed)
      if (req.body.column && req.body.column !== oldColumn) {
        eventBus.emitEvent('task.status_changed', {
          projectId: task.project_id,
          projectName,
          taskId: task.id,
          taskTitle: task.title,
          oldColumn,
          newColumn: req.body.column,
        })
      }
    }
```

**Important:** You must capture `oldAssigneeId`, `oldProgress`, and `oldColumn` BEFORE applying updates to the task. Add these lines before the update block:

```typescript
    const oldAssigneeId = task.assignee_id
    const oldProgress = task.progress || 0
    const oldColumn = task.column
```

**Step 3: Add emission to addComment method (around line 485-507)**

After `await commentRepo.save(comment)`, before `res.status(201).json(comment)`, add:

```typescript
    // Emit for Telegram
    const task = await AppDataSource.getRepository(Task).findOne({ where: { id: taskId } })
    if (task?.project_id) {
      const project = await AppDataSource.getRepository(Project).findOne({ where: { id: task.project_id } })
      eventBus.emitEvent('task.comment_added', {
        projectId: task.project_id,
        projectName: project?.name || '',
        taskId: task.id,
        taskTitle: task.title,
        authorId: req.user!.userId,
        text: req.body.text,
        attachmentUrl: req.body.attachment_url,
      })
    }
```

**Step 4: Add emission to addMember method (around line 544-571)**

After `await memberRepo.save(member)`, before response, add:

```typescript
    // Emit for Telegram
    const project = await AppDataSource.getRepository(Project).findOne({ where: { id } })
    const employee = await AppDataSource.getRepository(Employee).findOne({ where: { id: req.body.employee_id } })
    if (project && employee) {
      eventBus.emitEvent('project.member_added', {
        projectId: id,
        projectName: project.name,
        employeeName: employee.name,
        role: req.body.role,
      })
    }
```

**Step 5: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "feat: emit Telegram events from project controller"
```

---

### Task 9: Add Telegram Settings API Endpoints

**Files:**
- Modify: `backend/src/controllers/project.controller.ts` (add 4 methods)
- Modify: `backend/src/routes/project.routes.ts` (add 4 routes)

**Step 1: Add controller methods**

Add these methods to the `projectController` object in `backend/src/controllers/project.controller.ts`:

```typescript
  getTelegramSettings: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { getChatSettings } = await import('../services/telegram.service')
      const settings = await getChatSettings(id)
      res.json(settings || { linked: false })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  updateTelegramSettings: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { updateChatSettings } = await import('../services/telegram.service')
      const { rescheduleDigest } = await import('../services/telegram-scheduler')
      const updated = await updateChatSettings(id, req.body)
      if (!updated) return res.status(404).json({ error: 'Telegram chat not linked' })
      await rescheduleDigest(id)
      res.json(updated)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  unlinkTelegram: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { unlinkChat } = await import('../services/telegram.service')
      const { removeDigest } = await import('../services/telegram-scheduler')
      const removed = await unlinkChat(id)
      if (removed) removeDigest(id)
      res.json({ success: removed })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },

  sendTelegramTest: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const { sendTestMessage } = await import('../services/telegram.service')
      const sent = await sendTestMessage(id)
      res.json({ success: sent })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  },
```

**Step 2: Add routes**

In `backend/src/routes/project.routes.ts`, add before the `export default router` line:

```typescript
// Telegram settings
router.get('/:id/telegram', projectController.getTelegramSettings);
router.put('/:id/telegram', projectController.updateTelegramSettings);
router.delete('/:id/telegram', projectController.unlinkTelegram);
router.post('/:id/telegram/test', projectController.sendTelegramTest);
```

**Step 3: Verify build**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/controllers/project.controller.ts backend/src/routes/project.routes.ts
git commit -m "feat: add Telegram settings API endpoints"
```

---

### Task 10: Add Frontend API Methods

**Files:**
- Modify: `frontend/src/api/projects.ts`

**Step 1: Add TelegramChat interface**

After the existing `ProjectMember` interface, add:

```typescript
export interface TelegramChatSettings {
  id?: string
  project_id?: string
  chat_id?: string
  chat_title?: string
  digest_cron: string
  digest_enabled: boolean
  notifications_enabled: boolean
  linked: boolean
}
```

**Step 2: Add API methods**

Add to the `projectsApi` object:

```typescript
  getTelegramSettings: (projectId: string) =>
    api.get<TelegramChatSettings>(`/projects/${projectId}/telegram`).then(r => r.data),

  updateTelegramSettings: (projectId: string, data: Partial<TelegramChatSettings>) =>
    api.put<TelegramChatSettings>(`/projects/${projectId}/telegram`, data).then(r => r.data),

  unlinkTelegram: (projectId: string) =>
    api.delete(`/projects/${projectId}/telegram`).then(r => r.data),

  sendTelegramTest: (projectId: string) =>
    api.post(`/projects/${projectId}/telegram/test`).then(r => r.data),
```

**Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/api/projects.ts
git commit -m "feat: add Telegram settings API methods to frontend"
```

---

### Task 11: Add Telegram Section to Project Settings Modal

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: Add state variables**

After the existing state declarations (around line 38), add:

```typescript
  const [telegramSettings, setTelegramSettings] = useState<TelegramChatSettings | null>(null)
  const [telegramLoading, setTelegramLoading] = useState(false)
```

Add `TelegramChatSettings` to the import from `../api/projects`.

**Step 2: Load Telegram settings when settings modal opens**

In the settings button `onClick` handler (where `setShowSettings(true)` is called), add before `setShowSettings(true)`:

```typescript
              // Load Telegram settings
              setTelegramLoading(true)
              projectsApi.getTelegramSettings(id!).then(s => {
                setTelegramSettings(s)
                setTelegramLoading(false)
              }).catch(() => setTelegramLoading(false))
```

**Step 3: Add Telegram section in settings modal**

In the settings modal body, AFTER the Team section closing `</div>` (after the "Add member" row), add a new section:

```tsx
                {/* Telegram section */}
                <div className="border-t border-brand-border pt-4 mt-2">
                  <div className="text-sm font-semibold text-brand-text mb-3">Telegram</div>

                  {telegramLoading ? (
                    <p className="text-xs text-brand-text-secondary">Загрузка...</p>
                  ) : telegramSettings && telegramSettings.chat_id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <span className="text-green-600 dark:text-green-400 text-sm">✅</span>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          Привязан: <b>{telegramSettings.chat_title || 'Группа'}</b>
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brand-text-secondary">Уведомления</span>
                        <button
                          onClick={async () => {
                            const updated = await projectsApi.updateTelegramSettings(id!, {
                              notifications_enabled: !telegramSettings.notifications_enabled,
                            })
                            setTelegramSettings({ ...telegramSettings, ...updated })
                          }}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            telegramSettings.notifications_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            telegramSettings.notifications_enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-brand-text-secondary">Автосводка</span>
                        <button
                          onClick={async () => {
                            const updated = await projectsApi.updateTelegramSettings(id!, {
                              digest_enabled: !telegramSettings.digest_enabled,
                            })
                            setTelegramSettings({ ...telegramSettings, ...updated })
                          }}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            telegramSettings.digest_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            telegramSettings.digest_enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>

                      {telegramSettings.digest_enabled && (
                        <div>
                          <label className="text-xs text-brand-text-secondary mb-1 block">Частота сводки</label>
                          <select
                            value={telegramSettings.digest_cron}
                            onChange={async (e) => {
                              const updated = await projectsApi.updateTelegramSettings(id!, {
                                digest_cron: e.target.value,
                              })
                              setTelegramSettings({ ...telegramSettings, ...updated })
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                          >
                            <option value="0 9 * * *">Ежедневно (9:00)</option>
                            <option value="0 9 * * 1">Еженедельно (пн 9:00)</option>
                            <option value="0 9 1,15 * *">Раз в 2 недели</option>
                          </select>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await projectsApi.sendTelegramTest(id!)
                          }}
                          className="px-3 py-1.5 text-xs bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
                        >
                          Тестовое сообщение
                        </button>
                        <button
                          onClick={async () => {
                            await projectsApi.unlinkTelegram(id!)
                            setTelegramSettings({ linked: false, digest_cron: '0 9 * * 1', digest_enabled: true, notifications_enabled: true })
                          }}
                          className="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Отвязать чат
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-brand-text-secondary">Чат не привязан. Для привязки:</p>
                      <ol className="text-xs text-brand-text-secondary space-y-1 list-decimal list-inside">
                        <li>Добавьте бота в Telegram-группу проекта</li>
                        <li>Отправьте команду в группе:</li>
                      </ol>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-xl bg-brand-surface border border-brand-border text-xs text-brand-text font-mono">
                          /link {id}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`/link ${id}`)
                          }}
                          className="px-3 py-2 text-xs border border-brand-border rounded-xl text-brand-text-secondary hover:text-primary-500 hover:border-primary-300 transition-colors"
                        >
                          Копировать
                        </button>
                      </div>
                    </div>
                  )}
                </div>
```

**Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/pages/ProjectDetail.tsx frontend/src/api/projects.ts
git commit -m "feat: add Telegram settings section to project settings modal"
```

---

### Task 12: Add Environment Variables

**Files:**
- Modify: `backend/.env` (local)
- Note: Also add to Vercel environment variables

**Step 1: Add to .env**

```
TELEGRAM_BOT_TOKEN=       # Get from @BotFather
TELEGRAM_WEBHOOK_SECRET=  # Random string, e.g. openssl rand -hex 32
BACKEND_URL=              # Public URL of backend for webhook registration
```

**Step 2: Document in README or .env.example**

No code change needed — just ensure the variables are set before starting.

---

### Task 13: End-to-End Verification

**Step 1: Start backend**

Run: `cd backend && npm run dev`
Expected: Logs show "Telegram webhook set" and "Digest scheduler initialized" if TELEGRAM_BOT_TOKEN is set. If not set, no errors — just silently skips.

**Step 2: Verify all routes respond**

Run:
```bash
# Settings endpoints (will return 401 without auth, which proves route exists)
curl -s localhost:3001/api/projects/fake-id/telegram | head -1
curl -s -X PUT localhost:3001/api/projects/fake-id/telegram | head -1
```
Expected: `{"error":"..."}` (auth error, not 404)

**Step 3: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Clean build, no errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Telegram bot integration — notifications, commands, digests"
```
