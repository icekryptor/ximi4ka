# Planning (Kanban) — Design Doc

**Date:** 2026-03-31
**Status:** Approved

## Overview

Trello-like planning module for XimFinance ERP. Multiple boards (sheets), 5 fixed columns, drag-and-drop, employee assignment, comments with file attachments.

## Requirements

- Multiple boards (user-created, named freely)
- Fixed columns: Backlog, Todo, In Progress, Review, Done
- Assignee + supervisor per task (from Employee entity)
- Due dates, priority (high/medium/low)
- Color tags (user-created per board)
- Comments with file attachments (Supabase Storage)
- Drag-and-drop between columns
- All users see everything; edit only own tasks (or assigned/supervised)
- Russian UI throughout

## Data Model

### Board
```
id          UUID PK
name        varchar(255)
description text?
color       varchar(7)?       -- hex color for tab
sort_order  int default 0
created_by  UUID FK→User
is_archived boolean default false
created_at  timestamp
updated_at  timestamp
```

### Task
```
id            UUID PK
board_id      UUID FK→Board (CASCADE)
title         varchar(500)
description   text?
column        enum(backlog, todo, in_progress, review, done)
priority      enum(high, medium, low) default medium
assignee_id   UUID? FK→Employee
supervisor_id UUID? FK→Employee
due_date      date?
sort_order    int default 0      -- step 1000 for insertion gaps
created_by    UUID FK→User
created_at    timestamp
updated_at    timestamp
```

### TaskComment
```
id              UUID PK
task_id         UUID FK→Task (CASCADE)
author_id       UUID FK→User
text            text
attachment_url  varchar(1000)?   -- Supabase Storage URL
attachment_name varchar(255)?
created_at      timestamp
```

### TaskTag
```
id         UUID PK
board_id   UUID FK→Board (CASCADE)
name       varchar(100)
color      varchar(7)           -- hex color
created_at timestamp
```

### task_tags (join table)
```
task_id UUID FK→Task (CASCADE)
tag_id  UUID FK→TaskTag (CASCADE)
PK(task_id, tag_id)
```

## API

### Boards `/api/boards`
- `GET /` — list non-archived boards
- `POST /` — create board
- `PUT /:id` — update name/description/color
- `DELETE /:id` — archive (set is_archived=true)

### Tasks `/api/boards/:boardId/tasks`
- `GET /` — all tasks with relations (assignee, supervisor, tags, comment count)
- `POST /` — create task
- `PUT /:id` — update task fields
- `PATCH /:id/move` — `{ column, sort_order }` for drag-and-drop
- `DELETE /:id` — delete task

### Comments `/api/tasks/:taskId/comments`
- `GET /` — list comments with author
- `POST /` — create (multipart: text + optional file)
- `DELETE /:id` — delete own comment

### Tags `/api/boards/:boardId/tags`
- `GET /` — list board tags
- `POST /` — create tag `{ name, color }`
- `DELETE /:id` — delete tag

### Upload `/api/upload`
- `POST /` — upload file to Supabase Storage, return `{ url, name }`

## Frontend

### Navigation
New sidebar section "Планирование" (ClipboardList icon), between Production and Marketplaces.

### Page: Planning.tsx

**Top bar — board tabs:**
- Horizontal tab strip with board names + color dots
- "+ Новая доска" button
- Context menu per tab: rename, change color, archive

**Main area — kanban board:**
- 5 columns: Бэклог | К выполнению | В работе | На проверке | Готово
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop
- "+ Задача" button at bottom of each column

**Filters (above board):**
- Search by title
- Filter by assignee
- Filter by tag
- "Мои задачи" quick toggle

### Task card (compact):
```
[Tag1] [Tag2]                    -- color badges
Task title                       -- bold
👤 Assignee → 👁 Supervisor     -- names
📅 Date  💬 N  📎 N  Priority   -- meta row
```

### Task modal (on card click):
- Title + description (editable)
- Column, priority, due date
- Assignee, supervisor (dropdowns from Employee list)
- Tags (multi-select + create new)
- Comments feed with file attachment button
- Save / Delete buttons

## Permissions

- **View:** all authenticated users
- **Create tasks/comments:** all authenticated users
- **Edit task:** creator, assignee, or supervisor only
- **Delete comment:** author only
- **Create/archive boards:** ADMIN and MANAGER roles only

## Drag-and-Drop

- Library: `@dnd-kit/core` + `@dnd-kit/sortable`
- On drop: `PATCH /move` with `{ column, sort_order }`
- `sort_order` uses step of 1000 for gap insertion
- Optimistic UI: immediate move, rollback on error

## File Storage

- Supabase Storage bucket: `task-attachments`
- Upload via `/api/upload` endpoint
- URL stored in TaskComment.attachment_url
- Max file size: 10MB

## Tech Stack

- Backend: TypeORM entities + Express routes + controllers
- Frontend: React 18 + TypeScript + TailwindCSS
- DnD: @dnd-kit/core + @dnd-kit/sortable
- Files: Supabase Storage JS client
