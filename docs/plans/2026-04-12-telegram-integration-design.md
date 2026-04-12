# Telegram Integration Design

**Date:** 2026-04-12
**Status:** Approved

## Summary

Telegram bot integration for project group chats. One group chat per project. Bot sends event-driven notifications, responds to commands (`/status`, `/tasks`, `/digest`), and posts automatic periodic digests on a configurable cron schedule. Bot runs inside the existing Express backend.

## Architecture

```
Controllers (project, task, comment)
  │  emit('task.assigned', payload)
  ▼
EventBus (Node.js EventEmitter singleton)
  │
  ▼
TelegramNotificationListener
  │  formats message, resolves chat_id
  ▼
TelegramService
  │  Bot API via node-telegram-bot-api
  │  Webhook: POST /api/webhooks/telegram
  │  Commands: /link, /unlink, /status, /tasks, /digest
  ▼
Telegram Bot API
```

**Pattern:** Event Emitter. Controllers stay clean (single `emit` call). Listener handles formatting and delivery. All emits are fire-and-forget — controller never waits for Telegram response.

## New Files

| File | Purpose |
|------|---------|
| `backend/src/services/event-bus.ts` | Singleton EventEmitter |
| `backend/src/services/telegram.service.ts` | Bot API, webhook receiver, command handlers |
| `backend/src/services/telegram-listener.ts` | Subscribes to events, formats messages, sends |
| `backend/src/entities/TelegramChat.ts` | Entity: project <-> chat_id mapping |
| `backend/src/routes/telegram.routes.ts` | Webhook endpoint |

## Data Model

### Entity: `TelegramChat`

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid PK | |
| `project_id` | uuid FK -> projects, unique | One chat per project |
| `chat_id` | bigint | Telegram group chat ID |
| `chat_title` | varchar 255, nullable | Group name (for UI display) |
| `digest_cron` | varchar 50, default `'0 9 * * 1'` | Cron schedule (default: Mon 9:00) |
| `digest_enabled` | boolean, default true | Auto-digest on/off |
| `notifications_enabled` | boolean, default true | Event notifications on/off |
| `created_at` | timestamp | |

**Migration:** `CREATE TABLE telegram_chats` with unique index on `project_id`.

## Bot Commands

| Command | Action |
|---------|--------|
| `/link <project_id>` | Link chat to project. Saves chat_id + chat_title, responds with confirmation |
| `/unlink` | Unlink chat from project |
| `/status` | Project progress: %, task counts by status, overdue, budget, deadline |
| `/tasks` | List of active tasks: title, assignee, priority, progress, due date |
| `/digest` | Trigger digest manually (same format as automatic) |

**Webhook:** `POST /api/webhooks/telegram` — no JWT, verified by secret token in URL path (Telegram's built-in mechanism).

**Security for `/link`:** Project ID is a UUID (hard to guess). Additional protection (one-time token from UI) can be added later if needed.

## Events & Notification Templates

| Event | Controller Trigger | Template |
|-------|-------------------|----------|
| `task.assigned` | `updateTask` (assignee_id changed) | Task name, assignee, priority, deadline |
| `task.completed` | `updateTask` (progress=100 or column=done) | Task name, assignee |
| `task.status_changed` | `updateTask` (column changed) | Task name, old -> new status |
| `task.comment_added` | `addComment` | Task name, author, text (first 200 chars) |
| `task.deadline_approaching` | Cron job (1 day before due_date) | Task name, assignee, deadline |
| `project.member_added` | `addMember` | Employee name, role |

All messages use Telegram MarkdownV2 formatting with emoji indicators.

## Automatic Digest

**Scheduler:** `node-cron` inside Express server. On startup, loads all `telegram_chats` where `digest_enabled=true`, creates a cron job for each. When settings change, restarts the specific job.

**Digest content:**
- Tasks completed in period
- New tasks created
- Comments count
- Current progress (with delta)
- Overdue tasks list
- Upcoming deadlines

**Configurable frequency:** Daily (9:00), Weekly (Mon 9:00), Biweekly — stored as cron string in `digest_cron`.

## Frontend Changes

New section in existing **Project Settings modal** (after "Team"):

**When linked:**
- Status badge: "Привязан: Chat Title"
- Toggle: Notifications on/off
- Toggle: Auto-digest on/off
- Select: Digest frequency (daily/weekly/biweekly)
- Button: "Unlink chat"
- Button: "Send test message"

**When not linked:**
- 3-step instruction + copy project_id button

**New API endpoints:**
- `GET /api/projects/:id/telegram` — get chat settings
- `PUT /api/projects/:id/telegram` — update settings
- `DELETE /api/projects/:id/telegram` — unlink chat

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string for webhook URL verification |

## Dependencies

| Package | Purpose |
|---------|---------|
| `node-telegram-bot-api` | Telegram Bot API wrapper |
| `node-cron` | Cron scheduler for digests and deadline checks |
