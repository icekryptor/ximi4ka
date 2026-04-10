# Task Checklists & Comments Design

**Goal:** Add checklists (auto-progress) and comment threads with link attachments to project tasks.

## Data

### New entity: `TaskChecklistItem`
- id (uuid PK), task_id (FK tasks), title (varchar 500), is_checked (bool default false), sort_order (int), created_at

### Existing: `TaskComment`
Already has: id, task_id, author_id, text, attachment_url, attachment_name, created_at. Reuse as-is — attachment_url stores any user-provided link.

### Progress auto-calculation
`task.progress = checked / total * 100`. Recalculated on checklist toggle. If no checklist items — manual progress (slider).

## API

- `POST/PUT/DELETE /api/projects/:id/tasks/:taskId/checklist[/:itemId]`
- `GET/POST/DELETE /api/projects/:id/tasks/:taskId/comments[/:commentId]`

## UI

Task edit modal expands with two sections below existing fields:
1. **Checklist** — progress bar (`3 of 5`), checkbox items, inline add input
2. **Comments** — chronological thread, each with avatar + text + link chip + timestamp. Input at bottom with "attach link" button.

Progress slider replaced by auto-calculated progress when checklist exists.
