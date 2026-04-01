# Planning (Kanban) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Trello-like planning module with multiple boards, drag-and-drop kanban columns, task assignment, comments with file attachments.

**Architecture:** 4 new TypeORM entities (Board, Task, TaskComment, TaskTag) with ManyToMany join. Express REST controllers for CRUD + drag-and-drop. React page with @dnd-kit for drag-and-drop. Supabase Storage for file attachments.

**Tech Stack:** TypeORM + Express (backend), React 18 + TypeScript + TailwindCSS + @dnd-kit (frontend), Supabase Storage (files)

---

## Task 1: Create backend entities

**Files:**
- Create: `backend/src/entities/Board.ts`
- Create: `backend/src/entities/Task.ts`
- Create: `backend/src/entities/TaskComment.ts`
- Create: `backend/src/entities/TaskTag.ts`
- Modify: `backend/src/config/database.ts:22-34`

**Step 1: Create `backend/src/entities/Board.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Task } from './Task';
import { TaskTag } from './TaskTag';

@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название доски' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание' })
  description: string;

  @Column({ type: 'varchar', length: 7, nullable: true, comment: 'Цвет таба (hex)' })
  color: string;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки' })
  sort_order: number;

  @Column({ type: 'uuid', comment: 'Кто создал' })
  created_by: string;

  @Column({ type: 'boolean', default: false, comment: 'Архивирована' })
  is_archived: boolean;

  @OneToMany(() => Task, task => task.board)
  tasks: Task[];

  @OneToMany(() => TaskTag, tag => tag.board)
  tags: TaskTag[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

**Step 2: Create `backend/src/entities/TaskTag.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { Board } from './Board';

@Entity('task_tags')
export class TaskTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, board => board.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ type: 'uuid', comment: 'ID доски' })
  board_id: string;

  @Column({ type: 'varchar', length: 100, comment: 'Название тега' })
  name: string;

  @Column({ type: 'varchar', length: 7, comment: 'Цвет тега (hex)' })
  color: string;

  @CreateDateColumn()
  created_at: Date;
}
```

**Step 3: Create `backend/src/entities/Task.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { Board } from './Board';
import { Employee } from './Employee';
import { TaskComment } from './TaskComment';
import { TaskTag } from './TaskTag';

export enum TaskColumn {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
}

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('tasks')
@Index(['board_id', 'column', 'sort_order'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, board => board.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ type: 'uuid', comment: 'ID доски' })
  board_id: string;

  @Column({ type: 'varchar', length: 500, comment: 'Заголовок задачи' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание' })
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TaskColumn,
    default: TaskColumn.BACKLOG,
    comment: 'Колонка канбана',
  })
  column: TaskColumn;

  @Column({
    type: 'varchar',
    length: 10,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    comment: 'Приоритет',
  })
  priority: TaskPriority;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Исполнитель' })
  assignee_id: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Супервайзер' })
  supervisor_id: string;

  @Column({ type: 'date', nullable: true, comment: 'Дедлайн' })
  due_date: string;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки (шаг 1000)' })
  sort_order: number;

  @Column({ type: 'uuid', comment: 'Кто создал' })
  created_by: string;

  @ManyToMany(() => TaskTag)
  @JoinTable({
    name: 'task_tag_assignments',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TaskTag[];

  @OneToMany(() => TaskComment, comment => comment.task)
  comments: TaskComment[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

**Step 4: Create `backend/src/entities/TaskComment.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';

@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, task => task.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'uuid', comment: 'ID задачи' })
  task_id: string;

  @Column({ type: 'uuid', comment: 'Автор комментария (User.id)' })
  author_id: string;

  @Column({ type: 'text', comment: 'Текст комментария' })
  text: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, comment: 'URL файла в Supabase Storage' })
  attachment_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Имя файла' })
  attachment_name: string;

  @CreateDateColumn()
  created_at: Date;
}
```

**Step 5: Register entities in `backend/src/config/database.ts`**

After line 24 (`import { QcChecklist }...`), add:
```typescript
import { Board } from '../entities/Board';
import { Task } from '../entities/Task';
import { TaskComment } from '../entities/TaskComment';
import { TaskTag } from '../entities/TaskTag';
```

On line 34, append to `allEntities` array:
```typescript
const allEntities = [...existing..., Board, Task, TaskComment, TaskTag];
```

**Step 6: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

**Step 7: Commit**

```bash
git add backend/src/entities/Board.ts backend/src/entities/Task.ts backend/src/entities/TaskComment.ts backend/src/entities/TaskTag.ts backend/src/config/database.ts
git commit -m "feat: add Board, Task, TaskComment, TaskTag entities"
```

---

## Task 2: Create Supabase migration for tables

Since `synchronize: false` for Supabase, we need to create tables manually via SQL.

**Files:**
- Create: `backend/src/migrations/2026-03-31-planning-tables.sql`

**Step 1: Create migration SQL**

```sql
-- Boards
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  sort_order INT DEFAULT 0,
  created_by UUID NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task tags
CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  "column" VARCHAR(20) NOT NULL DEFAULT 'backlog',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  due_date DATE,
  sort_order INT DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_board_col_sort ON tasks(board_id, "column", sort_order);

-- Task-tag join table
CREATE TABLE IF NOT EXISTS task_tag_assignments (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  text TEXT NOT NULL,
  attachment_url VARCHAR(1000),
  attachment_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supabase Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;
```

**Step 2: Run migration on Supabase**

Execute via Supabase MCP tool `execute_sql` or Supabase Dashboard SQL Editor.

**Step 3: Commit**

```bash
git add backend/src/migrations/2026-03-31-planning-tables.sql
git commit -m "feat: add planning tables migration SQL"
```

---

## Task 3: Create backend controllers and routes

**Files:**
- Create: `backend/src/controllers/board.controller.ts`
- Create: `backend/src/controllers/task.controller.ts`
- Create: `backend/src/controllers/taskComment.controller.ts`
- Create: `backend/src/controllers/taskTag.controller.ts`
- Create: `backend/src/routes/board.routes.ts`
- Create: `backend/src/routes/task.routes.ts`
- Create: `backend/src/routes/taskComment.routes.ts`
- Create: `backend/src/routes/taskTag.routes.ts`

**Step 1: Create `backend/src/controllers/board.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Board } from '../entities/Board';

const repo = () => AppDataSource.getRepository(Board);

export const boardController = {
  async getAll(req: Request, res: Response) {
    try {
      const boards = await repo().find({
        where: { is_archived: false },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });
      res.json(boards);
    } catch (error) {
      console.error('Ошибка при получении досок:', error);
      res.status(500).json({ error: 'Ошибка при получении досок' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, description, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Название обязательно' });

      const maxSort = await repo()
        .createQueryBuilder('b')
        .select('COALESCE(MAX(b.sort_order), 0)', 'max')
        .getRawOne();

      const board = repo().create({
        name,
        description: description || null,
        color: color || null,
        sort_order: (maxSort?.max || 0) + 1,
        created_by: req.user!.userId,
      });
      const saved = await repo().save(board);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании доски:', error);
      res.status(500).json({ error: 'Ошибка при создании доски' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const board = await repo().findOne({ where: { id } });
      if (!board) return res.status(404).json({ error: 'Доска не найдена' });

      const { name, description, color } = req.body;
      if (name !== undefined) board.name = name;
      if (description !== undefined) board.description = description;
      if (color !== undefined) board.color = color;

      const saved = await repo().save(board);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении доски:', error);
      res.status(500).json({ error: 'Ошибка при обновлении доски' });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const board = await repo().findOne({ where: { id } });
      if (!board) return res.status(404).json({ error: 'Доска не найдена' });

      board.is_archived = true;
      await repo().save(board);
      res.json({ message: 'Доска архивирована' });
    } catch (error) {
      console.error('Ошибка при архивировании доски:', error);
      res.status(500).json({ error: 'Ошибка при архивировании доски' });
    }
  },
};
```

**Step 2: Create `backend/src/controllers/task.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Task } from '../entities/Task';
import { In } from 'typeorm';
import { TaskTag } from '../entities/TaskTag';

const repo = () => AppDataSource.getRepository(Task);
const tagRepo = () => AppDataSource.getRepository(TaskTag);

export const taskController = {
  async getAll(req: Request, res: Response) {
    try {
      const { boardId } = req.params;
      const tasks = await repo().find({
        where: { board_id: boardId },
        relations: ['assignee', 'supervisor', 'tags'],
        order: { sort_order: 'ASC' },
      });

      // Add comment count per task
      const taskIds = tasks.map(t => t.id);
      let commentCounts: Record<string, number> = {};
      if (taskIds.length > 0) {
        const counts = await AppDataSource.query(
          `SELECT task_id, COUNT(*)::int as count FROM task_comments WHERE task_id = ANY($1) GROUP BY task_id`,
          [taskIds]
        );
        commentCounts = Object.fromEntries(counts.map((r: any) => [r.task_id, r.count]));
      }

      const result = tasks.map(t => ({
        ...t,
        comment_count: commentCounts[t.id] || 0,
      }));

      res.json(result);
    } catch (error) {
      console.error('Ошибка при получении задач:', error);
      res.status(500).json({ error: 'Ошибка при получении задач' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { boardId } = req.params;
      const { title, description, column, priority, assignee_id, supervisor_id, due_date, tag_ids } = req.body;
      if (!title) return res.status(400).json({ error: 'Заголовок обязателен' });

      // Get max sort_order for this column
      const maxSort = await repo()
        .createQueryBuilder('t')
        .select('COALESCE(MAX(t.sort_order), 0)', 'max')
        .where('t.board_id = :boardId AND t.column = :col', { boardId, col: column || 'backlog' })
        .getRawOne();

      const task = repo().create({
        board_id: boardId,
        title,
        description: description || null,
        column: column || 'backlog',
        priority: priority || 'medium',
        assignee_id: assignee_id || null,
        supervisor_id: supervisor_id || null,
        due_date: due_date || null,
        sort_order: (maxSort?.max || 0) + 1000,
        created_by: req.user!.userId,
      });

      // Handle tags
      if (tag_ids && tag_ids.length > 0) {
        task.tags = await tagRepo().find({ where: { id: In(tag_ids) } });
      }

      const saved = await repo().save(task);
      const full = await repo().findOne({
        where: { id: saved.id },
        relations: ['assignee', 'supervisor', 'tags'],
      });
      res.status(201).json({ ...full, comment_count: 0 });
    } catch (error) {
      console.error('Ошибка при создании задачи:', error);
      res.status(500).json({ error: 'Ошибка при создании задачи' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await repo().findOne({ where: { id }, relations: ['tags'] });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const { title, description, column, priority, assignee_id, supervisor_id, due_date, tag_ids } = req.body;
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (column !== undefined) task.column = column;
      if (priority !== undefined) task.priority = priority;
      if (assignee_id !== undefined) task.assignee_id = assignee_id;
      if (supervisor_id !== undefined) task.supervisor_id = supervisor_id;
      if (due_date !== undefined) task.due_date = due_date;
      if (tag_ids !== undefined) {
        task.tags = tag_ids.length > 0 ? await tagRepo().find({ where: { id: In(tag_ids) } }) : [];
      }

      const saved = await repo().save(task);
      const full = await repo().findOne({
        where: { id: saved.id },
        relations: ['assignee', 'supervisor', 'tags'],
      });
      res.json(full);
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
      res.status(500).json({ error: 'Ошибка при обновлении задачи' });
    }
  },

  async move(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { column, sort_order } = req.body;
      const task = await repo().findOne({ where: { id } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      if (column !== undefined) task.column = column;
      if (sort_order !== undefined) task.sort_order = sort_order;

      await repo().save(task);
      res.json({ id: task.id, column: task.column, sort_order: task.sort_order });
    } catch (error) {
      console.error('Ошибка при перемещении задачи:', error);
      res.status(500).json({ error: 'Ошибка при перемещении задачи' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo().delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Задача не найдена' });
      res.json({ message: 'Задача удалена' });
    } catch (error) {
      console.error('Ошибка при удалении задачи:', error);
      res.status(500).json({ error: 'Ошибка при удалении задачи' });
    }
  },
};
```

**Step 3: Create `backend/src/controllers/taskComment.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TaskComment } from '../entities/TaskComment';
import { User } from '../entities/User';
import { uploadToStorage, BUCKETS, memoryUpload, deleteFromStorage } from '../utils/supabaseStorage';
import path from 'path';

const repo = () => AppDataSource.getRepository(TaskComment);
const userRepo = () => AppDataSource.getRepository(User);

export const uploadAttachment = memoryUpload(
  { fileSize: 10 * 1024 * 1024 },
);

export const taskCommentController = {
  async getAll(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const comments = await repo().find({
        where: { task_id: taskId },
        order: { created_at: 'ASC' },
      });

      // Fetch author names
      const authorIds = [...new Set(comments.map(c => c.author_id))];
      let authorMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const users = await userRepo().find({ where: authorIds.map(id => ({ id })) });
        authorMap = Object.fromEntries(users.map(u => [u.id, u.name]));
      }

      const result = comments.map(c => ({
        ...c,
        author_name: authorMap[c.author_id] || 'Неизвестный',
      }));
      res.json(result);
    } catch (error) {
      console.error('Ошибка при получении комментариев:', error);
      res.status(500).json({ error: 'Ошибка при получении комментариев' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: 'Текст комментария обязателен' });

      let attachment_url: string | null = null;
      let attachment_name: string | null = null;

      if (req.file) {
        const ext = path.extname(req.file.originalname);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        attachment_url = await uploadToStorage('task-attachments', filename, req.file.buffer, req.file.mimetype);
        attachment_name = req.file.originalname;
      }

      const comment = repo().create({
        task_id: taskId,
        author_id: req.user!.userId,
        text: text.trim(),
        attachment_url,
        attachment_name,
      });
      const saved = await repo().save(comment);

      // Get author name
      const user = await userRepo().findOne({ where: { id: req.user!.userId } });
      res.status(201).json({ ...saved, author_name: user?.name || 'Неизвестный' });
    } catch (error) {
      console.error('Ошибка при создании комментария:', error);
      res.status(500).json({ error: 'Ошибка при создании комментария' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const comment = await repo().findOne({ where: { id } });
      if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

      // Only author can delete
      if (comment.author_id !== req.user!.userId) {
        return res.status(403).json({ error: 'Можно удалять только свои комментарии' });
      }

      // Clean up attachment
      if (comment.attachment_url) {
        await deleteFromStorage('task-attachments', comment.attachment_url);
      }

      await repo().delete(id);
      res.json({ message: 'Комментарий удалён' });
    } catch (error) {
      console.error('Ошибка при удалении комментария:', error);
      res.status(500).json({ error: 'Ошибка при удалении комментария' });
    }
  },
};
```

**Step 4: Create `backend/src/controllers/taskTag.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TaskTag } from '../entities/TaskTag';

const repo = () => AppDataSource.getRepository(TaskTag);

export const taskTagController = {
  async getAll(req: Request, res: Response) {
    try {
      const { boardId } = req.params;
      const tags = await repo().find({
        where: { board_id: boardId },
        order: { created_at: 'ASC' },
      });
      res.json(tags);
    } catch (error) {
      console.error('Ошибка при получении тегов:', error);
      res.status(500).json({ error: 'Ошибка при получении тегов' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { boardId } = req.params;
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Название тега обязательно' });

      const tag = repo().create({
        board_id: boardId,
        name,
        color: color || '#836efe',
      });
      const saved = await repo().save(tag);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании тега:', error);
      res.status(500).json({ error: 'Ошибка при создании тега' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo().delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Тег не найден' });
      res.json({ message: 'Тег удалён' });
    } catch (error) {
      console.error('Ошибка при удалении тега:', error);
      res.status(500).json({ error: 'Ошибка при удалении тега' });
    }
  },
};
```

**Step 5: Create `backend/src/routes/board.routes.ts`**

```typescript
import { Router } from 'express';
import { boardController } from '../controllers/board.controller';
import { taskController } from '../controllers/task.controller';
import { taskTagController } from '../controllers/taskTag.controller';

const router = Router();

// Boards
router.get('/', boardController.getAll);
router.post('/', boardController.create);
router.put('/:id', boardController.update);
router.delete('/:id', boardController.archive);

// Tasks (nested under boards)
router.get('/:boardId/tasks', taskController.getAll);
router.post('/:boardId/tasks', taskController.create);
router.put('/:boardId/tasks/:id', taskController.update);
router.patch('/:boardId/tasks/:id/move', taskController.move);
router.delete('/:boardId/tasks/:id', taskController.delete);

// Tags (nested under boards)
router.get('/:boardId/tags', taskTagController.getAll);
router.post('/:boardId/tags', taskTagController.create);
router.delete('/:boardId/tags/:id', taskTagController.delete);

export default router;
```

**Step 6: Create `backend/src/routes/taskComment.routes.ts`**

```typescript
import { Router } from 'express';
import { taskCommentController, uploadAttachment } from '../controllers/taskComment.controller';

const router = Router();

router.get('/:taskId/comments', taskCommentController.getAll);
router.post('/:taskId/comments', uploadAttachment.single('file'), taskCommentController.create);
router.delete('/:taskId/comments/:id', taskCommentController.delete);

export default router;
```

**Step 7: Add `task-attachments` bucket to BUCKETS in `backend/src/utils/supabaseStorage.ts`**

Add to line 16 (`BUCKETS` object):
```typescript
export const BUCKETS = {
  components:      'components',
  employees:       'employees',
  supplyDocs:      'supply-docs',
  taskAttachments: 'task-attachments',
} as const;
```

**Step 8: Wire routes in `backend/src/server.ts`**

After line 29 (`import supplyDocumentRoutes...`), add:
```typescript
import boardRoutes from './routes/board.routes';
import taskCommentRoutes from './routes/taskComment.routes';
```

After line 90 (`app.use('/api/supply-documents'...)`), add:
```typescript
app.use('/api/boards', authMiddleware, boardRoutes);
app.use('/api/tasks', authMiddleware, taskCommentRoutes);
```

**Step 9: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

**Step 10: Commit**

```bash
git add backend/src/controllers/board.controller.ts backend/src/controllers/task.controller.ts backend/src/controllers/taskComment.controller.ts backend/src/controllers/taskTag.controller.ts backend/src/routes/board.routes.ts backend/src/routes/taskComment.routes.ts backend/src/utils/supabaseStorage.ts backend/src/server.ts
git commit -m "feat: add planning board/task/comment/tag controllers and routes"
```

---

## Task 4: Install frontend dependencies

**Step 1: Install @dnd-kit packages**

Run: `cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: install @dnd-kit for kanban drag-and-drop"
```

---

## Task 5: Create frontend API modules

**Files:**
- Create: `frontend/src/api/boards.ts`
- Create: `frontend/src/api/tasks.ts`

**Step 1: Create `frontend/src/api/boards.ts`**

```typescript
import { apiClient } from './client';

export interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const boardsApi = {
  getAll: async () => {
    const response = await apiClient.get<Board[]>('/boards');
    return response.data;
  },
  create: async (data: { name: string; description?: string; color?: string }) => {
    const response = await apiClient.post<Board>('/boards', data);
    return response.data;
  },
  update: async (id: string, data: Partial<{ name: string; description: string; color: string }>) => {
    const response = await apiClient.put<Board>(`/boards/${id}`, data);
    return response.data;
  },
  archive: async (id: string) => {
    await apiClient.delete(`/boards/${id}`);
  },
};
```

**Step 2: Create `frontend/src/api/tasks.ts`**

```typescript
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
```

**Step 3: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add frontend/src/api/boards.ts frontend/src/api/tasks.ts
git commit -m "feat: add frontend API modules for boards, tasks, comments, tags"
```

---

## Task 6: Build Planning.tsx page

This is the largest task. The page contains: board tabs, kanban columns, draggable task cards, filters.

**Files:**
- Create: `frontend/src/pages/Planning.tsx`

**Step 1: Create `frontend/src/pages/Planning.tsx`**

This is a large file (~600 lines). It contains:

1. Board tab bar with create/edit/archive
2. Kanban board with 5 columns
3. Draggable task cards using @dnd-kit
4. Quick-add task input at bottom of each column
5. Filters (search, assignee, tag, "my tasks")

The engineer should build this component with the following structure:

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, Search, User, Tag, Calendar, MessageSquare, Paperclip, GripVertical } from 'lucide-react'
import { boardsApi, Board } from '../api/boards'
import { tasksApi, tagsApi, TaskItem, TaskTag, TaskColumn, COLUMNS, COLUMN_LABELS, COLUMN_COLORS, PRIORITY_LABELS } from '../api/tasks'
import { employeesApi, Employee } from '../api/employees'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
```

**Key sub-components inside the file:**

- `SortableTaskCard` — wraps task card with `useSortable` hook
- `TaskCard` — compact card display (tags, title, assignee, due date, comment count)
- `KanbanColumn` — column with header, droppable area, sortable context, add button
- `BoardTabs` — horizontal tab strip with board names + add button
- `FilterBar` — search, assignee filter, tag filter, "my tasks" toggle

**Drag-and-drop logic:**
- `DndContext` wraps the board with `closestCorners` collision detection
- `PointerSensor` with 5px activation distance (prevent accidental drags)
- `onDragStart` — set activeId for overlay
- `onDragOver` — move card between columns (optimistic)
- `onDragEnd` — persist to API via `tasksApi.move()`
- `DragOverlay` — shows ghost card while dragging

**Note:** The complete JSX for this component is large. The engineer should follow the design doc exactly, using TailwindCSS classes consistent with the rest of the app. The card layout matches the design in the design doc (tags on top, title, assignee → supervisor, meta row).

**Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/pages/Planning.tsx
git commit -m "feat: add Planning page with kanban board and drag-and-drop"
```

---

## Task 7: Build TaskModal component

**Files:**
- Create: `frontend/src/components/TaskModal.tsx`

**Step 1: Create `frontend/src/components/TaskModal.tsx`**

Modal for viewing/editing a task. Contains:
- Title (editable input)
- Description (editable textarea)
- Column selector
- Priority selector
- Due date picker
- Assignee dropdown (from Employee list)
- Supervisor dropdown (from Employee list)
- Tag multi-select with "create new" option
- Comments feed with file attachment
- Delete button

Uses existing modal pattern from the project (overlay + centered card + close on backdrop click).

Key imports:
```typescript
import { useState, useEffect, useRef } from 'react'
import { X, Paperclip, Send, Trash2, Calendar, User, Eye, Tag } from 'lucide-react'
import { tasksApi, commentsApi, TaskItem, TaskComment, TaskColumn, TaskPriority, TaskTag, COLUMNS, COLUMN_LABELS, PRIORITY_LABELS } from '../api/tasks'
import { Employee } from '../api/employees'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
```

Props:
```typescript
interface Props {
  task: TaskItem
  boardId: string
  employees: Employee[]
  tags: TaskTag[]
  onClose: () => void
  onSaved: (task: TaskItem) => void
  onDeleted: (taskId: string) => void
  onTagCreated: (tag: TaskTag) => void
}
```

**Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/TaskModal.tsx
git commit -m "feat: add TaskModal component with comments and file attachments"
```

---

## Task 8: Add navigation and route

**Files:**
- Modify: `frontend/src/App.tsx:27-31,100-102`
- Modify: `frontend/src/components/Layout.tsx:239-283`

**Step 1: Add lazy import in `frontend/src/App.tsx`**

After line 31 (`const SalesReport = lazy...`), add:
```typescript
const Planning = lazy(() => import('./pages/Planning'))
```

**Step 2: Add route in `frontend/src/App.tsx`**

After line 102 (`<Route path="/quality-control"...>`), add:
```typescript
{/* Планирование */}
<Route path="/planning" element={<Planning />} />
```

**Step 3: Add nav icon and link in `frontend/src/components/Layout.tsx`**

Add a new SVG icon after `IconQualityControl` (around line 109):
```typescript
const IconPlanning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 3v18" />
  </svg>
)
```

In `NAV_GROUPS` array (line 239), add a new group after `production` (after line 283):
```typescript
{
  id: 'planning',
  label: 'Планирование',
  items: [
    { type: 'link', name: 'Канбан-доски', href: '/planning', icon: IconPlanning },
  ],
},
```

**Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add Planning navigation link and route"
```

---

## Task 9: Run migration and final verification

**Step 1: Run Supabase migration**

Execute the SQL from Task 2 on Supabase via MCP tool or Dashboard.

**Step 2: Full build check**

```bash
cd backend && npx tsc --noEmit && echo "✅ Backend OK"
cd frontend && npm run build && echo "✅ Frontend build OK"
```

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Planning (Kanban) module complete"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Entities | 4 new + database.ts |
| 2 | Migration SQL | 1 new |
| 3 | Controllers + routes | 6 new + server.ts + supabaseStorage.ts |
| 4 | Install @dnd-kit | package.json |
| 5 | Frontend API | 2 new |
| 6 | Planning.tsx page | 1 new (~600 lines) |
| 7 | TaskModal component | 1 new (~400 lines) |
| 8 | Navigation + route | App.tsx + Layout.tsx |
| 9 | Migration + verification | SQL + builds |
