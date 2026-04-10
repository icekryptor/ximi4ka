# Planning System: Departments, Recurring Tasks, Projects + Gantt

**Date:** 2026-04-10
**Status:** Approved

## Summary

Extend the existing kanban-based task system into a hierarchical planning system with departments (directions), recurring operational tasks with reporting, and project management with Gantt chart visualization.

## Architecture

```
Department (Направление)
├── Boards (existing kanban, linked via department_id)
├── Recurring Tasks (daily/weekly/monthly with free-text reports)
└── Projects (budget, deadline, deliverables)
    └── Tasks (hierarchical — parent_id for subtasks)
        └── Dependencies (blocking or informational)
```

Gantt chart only for Projects. Kanban remains for operational work. Single Task entity serves both views.

## Data Model

### New Entities

#### `Department`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | varchar(100) | Производство, Управление, Маркетинг, Продажи, Юридическое, Финансовое |
| color | varchar(7) | Hex color |
| sort_order | int | Display order |
| created_at | timestamp | |

Fixed set of 6 departments, seeded at migration.

#### `DepartmentRole`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| department_id | uuid | FK → departments |
| role | varchar(20) | head / member / viewer |
| created_at | timestamp | |

Unique constraint on (user_id, department_id).

#### `Project`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| department_id | uuid | FK → departments |
| name | varchar(200) | |
| description | text | |
| budget | decimal(12,2) | Total budget |
| start_date | date | |
| end_date | date | |
| deliverables | text | Requirements for final product |
| status | varchar(20) | draft / active / on_hold / completed / cancelled |
| created_by | uuid | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `RecurringTask`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| department_id | uuid | FK → departments |
| title | varchar(300) | |
| instruction | text | Immutable report format template (shown via button) |
| frequency | varchar(20) | daily / weekly / monthly / custom |
| frequency_days | int[] | For custom: days of week [1,3,5] (1=Mon, 7=Sun) |
| assignee_id | uuid | FK → employees |
| is_active | boolean | default true |
| created_at | timestamp | |

#### `RecurringTaskReport`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| recurring_task_id | uuid | FK → recurring_tasks |
| author_id | uuid | FK → users |
| report_date | date | Date the report covers |
| text | text | Free-form report text |
| created_at | timestamp | |

Unique constraint on (recurring_task_id, report_date) to prevent duplicate reports per day.

#### `TaskDependency`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| predecessor_id | uuid | FK → tasks |
| successor_id | uuid | FK → tasks |
| type | varchar(20) | finish_to_start (default) |
| is_blocking | boolean | false = informational arrows, true = blocks status change |

### Modified Entities

#### `Board` — add column
- `department_id` uuid FK → departments, nullable (backward compat)

#### `Task` — add columns
- `parent_id` uuid FK → tasks, nullable (subtask hierarchy)
- `project_id` uuid FK → projects, nullable
- `start_date` date, nullable (Gantt needs start + end)
- `progress` int default 0 (0-100, for Gantt progress bar)

## UI Design

### Navigation

Replace single "Планирование" menu item with expandable section:

```
Планирование
  ├── Направления        — overview grid
  ├── Проекты            — project list with filters
  ├── Регулярные задачи  — list with today's status
  └── Канбан             — existing board view, filtered by department
```

### Departments Page (`/planning/departments`)

Grid of 6 department cards showing:
- Name + color accent
- Active projects count
- Recurring tasks count
- Team members count

Click → department detail page with tabs: **Проекты** | **Регулярные задачи**

### Project Page with Gantt (`/planning/projects/:id`)

**Header:** project name, status badge, budget (spent/total), progress bar, deadline

**Body — Gantt view:**
- Left panel: collapsible task tree
  ```
  ▼ Task 1              Ivanov    01.04–15.04   ████░░ 60%
      Subtask 1.1        Petrov    01.04–07.04   ██████ 100%
      Subtask 1.2        Sidorov   08.04–15.04   ██░░░░ 30%
  ▶ Task 2              Ivanov    16.04–30.04   ░░░░░░ 0%
  ```
- Right panel: timeline with bars, dependency arrows, today marker
- Scale switcher: day / week / month
- Drag to change dates, click to edit task detail

**Library:** `gantt-task-react` (MIT, React component with tree + timeline)

### Recurring Tasks Page (`/planning/recurring`)

Table view:
```
Task                    | Frequency    | Assignee    | Today
Проверка остатков       | Ежедневно    | Петров      | ✅ Отчёт сдан
Отправка отчёта         | Пн, Ср, Пт  | Иванова     | ⏳ Ожидает
Инвентаризация          | Ежемесячно   | Сидоров     | — (не сегодня)
```

Click → task detail card:
- Instruction button (read-only template)
- Report feed (past reports by date)
- New report form (textarea + submit)

### Kanban (`/planning/kanban`)

Existing kanban with department filter dropdown added to the top.

## Access Control

### Roles per Department

| Role | Sees | Can do |
|------|------|--------|
| **head** | Everything in department | Create/edit projects, tasks, assign people, view all reports |
| **member** | Own tasks + projects where assigned | Update own task status/progress, write recurring reports |
| **viewer** | Everything in department | Read only |

**Admin** (existing `users.role = 'admin'`) — full access to all departments.

### Implementation

- Middleware `departmentAccess(minRole)` checks `DepartmentRole` for user + department
- API endpoints filter data by role (member sees only assigned tasks)
- Frontend conditionally renders create/edit buttons based on role

## Release Plan

### Release 1: Foundation
- Entities: Department, DepartmentRole
- Migration: Board.department_id, seed 6 departments
- UI: departments page, navigation restructure
- Basic access control middleware
- **Value:** departments visible, boards grouped, kanban works as before

### Release 2: Recurring Tasks
- Entities: RecurringTask, RecurringTaskReport
- UI: recurring task list, detail card with instruction button, report form, report feed
- Status indicators: submitted / awaiting / not today
- **Value:** operational reporting works

### Release 3: Projects + Gantt
- Entities: Project, TaskDependency
- Task extensions: parent_id, project_id, start_date, progress
- UI: project page with Gantt (gantt-task-react), task tree, dependencies, scale switcher
- Dependency toggle: blocking vs informational
- **Value:** full project management with Gantt

## Dependencies

- **New frontend package:** `gantt-task-react` (Release 3 only)
- **No new backend packages**

## Security

- DepartmentRole enforced at API level, not just frontend
- Admin bypass for all department checks
- Recurring task instructions immutable via API (no update endpoint for instruction field)
