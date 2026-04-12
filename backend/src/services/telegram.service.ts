import TelegramBot from 'node-telegram-bot-api'
import jwt from 'jsonwebtoken'
import { AppDataSource } from '../config/database'
import { getJwtSecret } from '../config/auth'
import { TelegramChat } from '../entities/TelegramChat'
import { Project } from '../entities/Project'
import { ProjectMember } from '../entities/ProjectMember'
import { Employee } from '../entities/Employee'
import { Task, TaskColumn, TaskPriority } from '../entities/Task'

// ── Label maps ──────────────────────────────────────────────────────────
const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Бэклог',
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На ревью',
  done: 'Готово',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активный',
  on_hold: 'На паузе',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const PRIORITY_ICON: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

// ── ERP link helpers ───────────────────────────────────────────────────

function frontendBase(): string {
  return (process.env.FRONTEND_URL || 'https://ximi4ka.vercel.app').replace(/\/$/, '')
}

/** Public project page URL (no token — shows "request access" prompt) */
export function projectUrl(projectId: string): string {
  return `${frontendBase()}/project/${projectId}`
}

/** Public project page URL with personal JWT token */
export function projectUrlWithToken(projectId: string, employeeId: string): string {
  const token = jwt.sign(
    { projectId, employeeId, scope: 'telegram-project' },
    getJwtSecret(),
    { expiresIn: '30d' },
  )
  return `${frontendBase()}/project/${projectId}?token=${token}`
}

/** Generic ERP link for group messages (no personal token) */
export function erpLink(projectId: string): string {
  return `\n🔗 <a href="${projectUrl(projectId)}">Открыть в ERP</a>`
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function progressBar(pct: number, len = 10): string {
  const filled = Math.round((pct / 100) * len)
  return '▓'.repeat(filled) + '░'.repeat(len - filled)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatBudget(v: number | string | null | undefined): string {
  if (v == null) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

// ── Lazy singleton bot ──────────────────────────────────────────────────

let _bot: TelegramBot | null = null

function getBot(): TelegramBot | null {
  if (_bot) return _bot
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  _bot = new TelegramBot(token) // no polling — webhook only
  return _bot
}

// ── Repositories helper ─────────────────────────────────────────────────

function chatRepo() {
  return AppDataSource.getRepository(TelegramChat)
}

function projectRepo() {
  return AppDataSource.getRepository(Project)
}

function taskRepo() {
  return AppDataSource.getRepository(Task)
}

// ── Public API ──────────────────────────────────────────────────────────

/** Fire-and-forget HTML message */
export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  const bot = getBot()
  if (!bot) return
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
  } catch (err) {
    console.error('[TelegramService] sendMessage error:', err)
  }
}

/** Returns chat_id if project has a linked chat with notifications enabled */
export async function getChatIdForProject(projectId: string): Promise<string | null> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat || !chat.notifications_enabled) return null
  return chat.chat_id
}

/** Returns TelegramChat entity or null */
export async function getChatSettings(projectId: string): Promise<TelegramChat | null> {
  return chatRepo().findOne({ where: { project_id: projectId } })
}

/** Partial update of digest/notification settings */
export async function updateChatSettings(
  projectId: string,
  data: Partial<Pick<TelegramChat, 'digest_enabled' | 'digest_cron' | 'notifications_enabled'>>,
): Promise<TelegramChat | null> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat) return null
  Object.assign(chat, data)
  return chatRepo().save(chat)
}

/** Delete TelegramChat record for project */
export async function unlinkChat(projectId: string): Promise<void> {
  await chatRepo().delete({ project_id: projectId })
}

/** Send a test message to the linked chat */
export async function sendTestMessage(projectId: string): Promise<boolean> {
  const chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (!chat) return false
  await sendMessage(chat.chat_id, '✅ <b>Тестовое сообщение</b>\nИнтеграция с Telegram работает!')
  return true
}

// ── Webhook handler ─────────────────────────────────────────────────────

export async function handleWebhook(body: any): Promise<void> {
  const message = body?.message
  if (!message?.text) return

  const text: string = message.text
  const chatId: number = message.chat.id
  const chatTitle: string = message.chat.title || message.chat.first_name || ''
  const fromUser = message.from

  // Strip @botname suffix from commands
  const match = text.match(/^\/(\w+)(?:@\S+)?\s*(.*)$/)
  if (!match) return

  const command = match[1]
  const args = match[2].trim()

  try {
    switch (command) {
      case 'link':
        await handleLink(chatId, chatTitle, args)
        break
      case 'unlink':
        await handleUnlink(chatId)
        break
      case 'status':
        await handleStatus(chatId)
        break
      case 'tasks':
        await handleTasks(chatId)
        break
      case 'digest':
        await handleDigestCommand(chatId)
        break
      case 'mylink':
        await handleMyLink(chatId, fromUser)
        break
      default:
        // Unknown command — ignore
        break
    }
  } catch (err) {
    console.error('[TelegramService] handleWebhook error:', err)
    await sendMessage(chatId, '⚠️ Произошла ошибка при обработке команды.')
  }
}

// ── Command handlers ────────────────────────────────────────────────────

async function handleLink(chatId: number, chatTitle: string, projectId: string): Promise<void> {
  if (!projectId) {
    await sendMessage(chatId, '⚠️ Укажите ID проекта: <code>/link &lt;project_id&gt;</code>')
    return
  }

  const project = await projectRepo().findOne({ where: { id: projectId } })
  if (!project) {
    await sendMessage(chatId, '❌ Проект не найден.')
    return
  }

  let chat = await chatRepo().findOne({ where: { project_id: projectId } })
  if (chat) {
    chat.chat_id = String(chatId)
    chat.chat_title = chatTitle
  } else {
    chat = chatRepo().create({
      project_id: projectId,
      chat_id: String(chatId),
      chat_title: chatTitle,
    })
  }
  await chatRepo().save(chat)

  await sendMessage(
    chatId,
    `✅ Чат привязан к проекту <b>${escapeHtml(project.name)}</b>`,
  )
}

async function handleUnlink(chatId: number): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: String(chatId) } })
  if (!chat) {
    await sendMessage(chatId, 'ℹ️ Этот чат не привязан ни к одному проекту.')
    return
  }
  const projectId = chat.project_id
  await chatRepo().remove(chat)
  await sendMessage(chatId, `🔓 Чат отвязан от проекта <code>${escapeHtml(projectId)}</code>`)
}

async function handleStatus(chatId: number): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: String(chatId) } })
  if (!chat) {
    await sendMessage(chatId, 'ℹ️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }

  const project = await projectRepo().findOne({ where: { id: chat.project_id } })
  if (!project) {
    await sendMessage(chatId, '❌ Проект не найден.')
    return
  }

  const tasks = await taskRepo().find({ where: { project_id: project.id } })
  const total = tasks.length
  const done = tasks.filter(t => t.column === TaskColumn.DONE || t.progress >= 100).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const highCount = tasks.filter(t => t.priority === TaskPriority.HIGH).length
  const mediumCount = tasks.filter(t => t.priority === TaskPriority.MEDIUM).length
  const lowCount = tasks.filter(t => t.priority === TaskPriority.LOW).length

  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = tasks.filter(
    t => t.due_date && t.due_date < today && t.column !== TaskColumn.DONE && t.progress < 100,
  ).length

  const statusLabel = STATUS_LABELS[project.status] || project.status

  const lines = [
    `📊 <b>${escapeHtml(project.name)}</b>`,
    `Статус: <b>${escapeHtml(statusLabel)}</b>`,
    '',
    `Прогресс: ${progressBar(pct)} ${pct}%`,
    `Задачи: ${done}/${total}`,
    '',
    `🔴 Высокий: ${highCount}  🟡 Средний: ${mediumCount}  🟢 Низкий: ${lowCount}`,
    `⏰ Просрочено: ${overdueCount}`,
    '',
    `💰 Бюджет: ${formatBudget(project.budget)}`,
    `📅 Дедлайн: ${formatDate(project.end_date)}`,
    erpLink(project.id),
  ]

  await sendMessage(chatId, lines.join('\n'))
}

async function handleTasks(chatId: number): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: String(chatId) } })
  if (!chat) {
    await sendMessage(chatId, 'ℹ️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }

  const tasks = await taskRepo().find({
    where: { project_id: chat.project_id },
    relations: ['assignee'],
    order: { priority: 'ASC', due_date: 'ASC' },
  })

  const active = tasks.filter(t => t.column !== TaskColumn.DONE && t.progress < 100)

  if (active.length === 0) {
    await sendMessage(chatId, 'ℹ️ Нет активных задач.')
    return
  }

  const shown = active.slice(0, 15)
  const lines = [`📋 <b>Активные задачи</b> (${active.length})\n`]

  for (const t of shown) {
    const icon = PRIORITY_ICON[t.priority] || '⚪'
    const assignee = t.assignee ? escapeHtml(t.assignee.name) : '—'
    const col = COLUMN_LABELS[t.column] || t.column
    const due = t.due_date ? formatDate(t.due_date) : '—'
    lines.push(`${icon} <b>${escapeHtml(t.title)}</b>`)
    lines.push(`   ${escapeHtml(col)} · ${t.progress}% · 📅 ${due} · 👤 ${assignee}`)
  }

  if (active.length > 15) {
    lines.push(`\n… и ещё ${active.length - 15}`)
  }

  lines.push(erpLink(chat.project_id))

  await sendMessage(chatId, lines.join('\n'))
}

async function handleDigestCommand(chatId: number): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: String(chatId) } })
  if (!chat) {
    await sendMessage(chatId, 'ℹ️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }
  await sendDigestForProject(chat.project_id, chat.chat_id)
}

async function handleMyLink(chatId: number, fromUser: any): Promise<void> {
  const chat = await chatRepo().findOne({ where: { chat_id: String(chatId) } })
  if (!chat) {
    await sendMessage(chatId, 'ℹ️ Чат не привязан. Используйте <code>/link &lt;project_id&gt;</code>')
    return
  }

  // Find employee by Telegram username
  const username = fromUser?.username
  if (!username) {
    await sendMessage(chatId, '⚠️ У вас не установлен username в Telegram. Настройте его в настройках Telegram.')
    return
  }

  const employeeRepository = AppDataSource.getRepository(Employee)
  // Match with or without @ prefix
  const employee = await employeeRepository
    .createQueryBuilder('e')
    .where('LOWER(REPLACE(e.telegram, \'@\', \'\')) = LOWER(:username)', { username: username.replace('@', '') })
    .getOne()

  if (!employee) {
    await sendMessage(chatId, `⚠️ Сотрудник с Telegram <b>@${escapeHtml(username)}</b> не найден в системе. Попросите администратора добавить ваш Telegram в карточку сотрудника.`)
    return
  }

  // Verify employee is a member or responsible of this project
  const project = await projectRepo().findOne({ where: { id: chat.project_id } })
  if (!project) {
    await sendMessage(chatId, '❌ Проект не найден.')
    return
  }

  const isMember = await AppDataSource.getRepository(ProjectMember).findOne({
    where: { project_id: chat.project_id, employee_id: employee.id },
  })
  const isResponsible = project.responsible_id === employee.id

  if (!isMember && !isResponsible) {
    await sendMessage(chatId, '⚠️ Вы не являетесь участником этого проекта.')
    return
  }

  const url = projectUrlWithToken(chat.project_id, employee.id)
  const role = isResponsible ? 'Ответственный' : 'Участник'

  // Send personal link in DM
  const bot = getBot()
  if (!bot) return

  try {
    await bot.sendMessage(
      fromUser.id,
      [
        `🔑 <b>Персональная ссылка на проект</b>`,
        `Проект: <b>${escapeHtml(project.name)}</b>`,
        `Роль: ${role}`,
        '',
        `🔗 <a href="${url}">Открыть проект</a>`,
        '',
        `⚠️ Ссылка действительна 30 дней. Не передавайте её другим.`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    )
    await sendMessage(chatId, `✅ @${escapeHtml(username)}, персональная ссылка отправлена вам в личные сообщения.`)
  } catch (err: any) {
    // If DM fails — user hasn't started a conversation with the bot
    if (err.response?.body?.error_code === 403) {
      await sendMessage(
        chatId,
        `⚠️ @${escapeHtml(username)}, я не могу отправить вам личное сообщение. Напишите боту /start в личном чате и попробуйте снова.`,
      )
    } else {
      throw err
    }
  }
}

// ── Digest ──────────────────────────────────────────────────────────────

export async function sendDigestForProject(projectId: string, chatId?: string | number): Promise<void> {
  if (!chatId) {
    const chat = await chatRepo().findOne({ where: { project_id: projectId } })
    if (!chat) return
    chatId = chat.chat_id
  }

  const project = await projectRepo().findOne({ where: { id: projectId } })
  if (!project) return

  const tasks = await taskRepo().find({
    where: { project_id: projectId },
    relations: ['assignee'],
  })

  const total = tasks.length
  const done = tasks.filter(t => t.column === TaskColumn.DONE || t.progress >= 100).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Overdue tasks
  const overdue = tasks.filter(
    t => t.due_date && t.due_date < todayStr && t.column !== TaskColumn.DONE && t.progress < 100,
  )

  // Upcoming deadlines (next 7 days)
  const in7days = new Date(today)
  in7days.setDate(in7days.getDate() + 7)
  const in7daysStr = in7days.toISOString().slice(0, 10)

  const upcoming = tasks.filter(
    t =>
      t.due_date &&
      t.due_date >= todayStr &&
      t.due_date <= in7daysStr &&
      t.column !== TaskColumn.DONE &&
      t.progress < 100,
  )

  const lines = [
    `📬 <b>Дайджест: ${escapeHtml(project.name)}</b>`,
    '',
    `Прогресс: ${progressBar(pct)} ${pct}%`,
    `Завершено: ${done}/${total}`,
  ]

  if (overdue.length > 0) {
    lines.push('')
    lines.push(`🚨 <b>Просроченные (${overdue.length}):</b>`)
    for (const t of overdue.slice(0, 10)) {
      const assignee = t.assignee ? escapeHtml(t.assignee.name) : '—'
      lines.push(`  • ${escapeHtml(t.title)} — 📅 ${formatDate(t.due_date)} · 👤 ${assignee}`)
    }
    if (overdue.length > 10) lines.push(`  … и ещё ${overdue.length - 10}`)
  }

  if (upcoming.length > 0) {
    lines.push('')
    lines.push(`📅 <b>Ближайшие дедлайны (7 дн):</b>`)
    for (const t of upcoming.slice(0, 10)) {
      const assignee = t.assignee ? escapeHtml(t.assignee.name) : '—'
      lines.push(`  • ${escapeHtml(t.title)} — 📅 ${formatDate(t.due_date)} · 👤 ${assignee}`)
    }
    if (upcoming.length > 10) lines.push(`  … и ещё ${upcoming.length - 10}`)
  }

  if (overdue.length === 0 && upcoming.length === 0) {
    lines.push('')
    lines.push('✅ Нет просроченных задач и ближайших дедлайнов.')
  }

  lines.push(erpLink(projectId))

  await sendMessage(chatId, lines.join('\n'))
}

// ── Webhook setup ───────────────────────────────────────────────────────

export async function setupWebhook(baseUrl: string): Promise<void> {
  const bot = getBot()
  if (!bot) {
    console.warn('[TelegramService] No TELEGRAM_BOT_TOKEN — skipping webhook setup')
    return
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[TelegramService] No TELEGRAM_WEBHOOK_SECRET — skipping webhook setup')
    return
  }
  const url = `${baseUrl}/api/webhooks/telegram/${secret}`
  try {
    await bot.setWebHook(url)
    console.log(`[TelegramService] Webhook set: ${url}`)
  } catch (err) {
    console.error('[TelegramService] setupWebhook error:', err)
  }
}
