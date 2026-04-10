import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Project } from '../entities/Project';
import { ProjectMember } from '../entities/ProjectMember';
import { Task } from '../entities/Task';
import { TaskDependency } from '../entities/TaskDependency';
import { TaskChecklistItem } from '../entities/TaskChecklistItem';
import { TaskComment } from '../entities/TaskComment';

const projectRepo = () => AppDataSource.getRepository(Project);
const memberRepo = () => AppDataSource.getRepository(ProjectMember);
const taskRepo = () => AppDataSource.getRepository(Task);
const depRepo = () => AppDataSource.getRepository(TaskDependency);
const checklistRepo = () => AppDataSource.getRepository(TaskChecklistItem);
const commentRepo = () => AppDataSource.getRepository(TaskComment);

async function recalcProgress(taskId: string): Promise<void> {
  const items = await checklistRepo().find({ where: { task_id: taskId } });
  if (items.length === 0) return;
  const checked = items.filter(i => i.is_checked).length;
  const progress = Math.round((checked / items.length) * 100);
  await taskRepo().update(taskId, { progress });
}

export const projectController = {
  async getAll(req: Request, res: Response) {
    try {
      const where: any = {};
      if (req.query.department_id) where.department_id = req.query.department_id;
      if (req.query.status) where.status = req.query.status;

      const projects = await projectRepo().find({
        where,
        relations: ['department', 'responsible'],
        order: { created_at: 'DESC' },
      });

      const enriched = await Promise.all(
        projects.map(async (project) => {
          const tasks = await taskRepo().find({
            where: { project_id: project.id },
          });
          const taskCount = tasks.length;
          const avgProgress = taskCount > 0
            ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / taskCount)
            : 0;
          return { ...project, task_count: taskCount, avg_progress: avgProgress };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error('Ошибка при получении проектов:', error);
      res.status(500).json({ error: 'Ошибка при получении проектов' });
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await projectRepo().findOne({
        where: { id },
        relations: ['department', 'responsible'],
      });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const tasks = await taskRepo().find({
        where: { project_id: id },
        relations: ['assignee'],
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });

      const taskIds = tasks.map(t => t.id);
      let dependencies: TaskDependency[] = [];
      if (taskIds.length > 0) {
        dependencies = await depRepo()
          .createQueryBuilder('d')
          .where('d.predecessor_id IN (:...ids) OR d.successor_id IN (:...ids)', { ids: taskIds })
          .getMany();
      }

      // Fetch checklist items for all tasks in one query
      const checklistItems = taskIds.length > 0
        ? await checklistRepo().find({
            where: { task_id: In(taskIds) },
            order: { sort_order: 'ASC', created_at: 'ASC' },
          })
        : [];

      // Group checklist items by task_id
      const checklistByTask = new Map<string, TaskChecklistItem[]>();
      checklistItems.forEach(item => {
        const list = checklistByTask.get(item.task_id) || [];
        list.push(item);
        checklistByTask.set(item.task_id, list);
      });

      const tasksWithChecklist = tasks.map(t => ({
        ...t,
        checklist: checklistByTask.get(t.id) || [],
      }));

      const members = await memberRepo().find({
        where: { project_id: id },
        relations: ['employee'],
        order: { created_at: 'ASC' },
      });

      res.json({ ...project, tasks: tasksWithChecklist, dependencies, members });
    } catch (error) {
      console.error('Ошибка при получении проекта:', error);
      res.status(500).json({ error: 'Ошибка при получении проекта' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { department_id, name, description, budget, start_date, end_date, deliverables, status, responsible_id } = req.body;
      if (!department_id || !name) return res.status(400).json({ error: 'department_id и name обязательны' });

      const project = projectRepo().create({
        department_id,
        name,
        description: description || null,
        budget: budget || 0,
        start_date: start_date || null,
        end_date: end_date || null,
        deliverables: deliverables || null,
        status: status || 'draft',
        responsible_id: responsible_id || null,
        created_by: req.user!.userId,
      });
      const saved = await projectRepo().save(project);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании проекта:', error);
      res.status(500).json({ error: 'Ошибка при создании проекта' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await projectRepo().findOne({ where: { id } });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const { name, description, budget, start_date, end_date, deliverables, status, responsible_id } = req.body;
      if (name !== undefined) project.name = name;
      if (description !== undefined) project.description = description;
      if (budget !== undefined) project.budget = budget;
      if (start_date !== undefined) project.start_date = start_date;
      if (end_date !== undefined) project.end_date = end_date;
      if (deliverables !== undefined) project.deliverables = deliverables;
      if (status !== undefined) project.status = status;
      if (responsible_id !== undefined) project.responsible_id = responsible_id;

      const saved = await projectRepo().save(project);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении проекта:', error);
      res.status(500).json({ error: 'Ошибка при обновлении проекта' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await projectRepo().delete(id);
      if (result.affected === 0) return res.status(404).json({ error: 'Проект не найден' });
      res.json({ message: 'Проект удалён' });
    } catch (error) {
      console.error('Ошибка при удалении проекта:', error);
      res.status(500).json({ error: 'Ошибка при удалении проекта' });
    }
  },

  async addTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, assignee_id, start_date, due_date, parent_id, priority } = req.body;
      if (!title) return res.status(400).json({ error: 'title обязателен' });

      const project = await projectRepo().findOne({ where: { id } });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const task = taskRepo().create({
        project_id: id,
        board_id: req.body.board_id || null,
        title,
        description: description || null,
        assignee_id: assignee_id || null,
        start_date: start_date || null,
        due_date: due_date || null,
        parent_id: parent_id || null,
        priority: priority || 'medium',
        progress: 0,
        created_by: req.user!.userId,
      });
      const saved = await taskRepo().save(task);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании задачи проекта:', error);
      res.status(500).json({ error: 'Ошибка при создании задачи' });
    }
  },

  async updateTask(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await taskRepo().findOne({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const { title, description, assignee_id, start_date, due_date, progress, parent_id, column, priority } = req.body;
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (assignee_id !== undefined) task.assignee_id = assignee_id;
      if (start_date !== undefined) task.start_date = start_date;
      if (due_date !== undefined) task.due_date = due_date;
      if (progress !== undefined) task.progress = progress;
      if (parent_id !== undefined) task.parent_id = parent_id;
      if (column !== undefined) task.column = column;
      if (priority !== undefined) task.priority = priority;

      const saved = await taskRepo().save(task);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
      res.status(500).json({ error: 'Ошибка при обновлении задачи' });
    }
  },

  async addDependency(req: Request, res: Response) {
    try {
      const { predecessor_id, successor_id, is_blocking } = req.body;
      if (!predecessor_id || !successor_id) {
        return res.status(400).json({ error: 'predecessor_id и successor_id обязательны' });
      }

      const dep = depRepo().create({
        predecessor_id,
        successor_id,
        type: 'finish_to_start',
        is_blocking: is_blocking || false,
      });
      const saved = await depRepo().save(dep);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании зависимости:', error);
      res.status(500).json({ error: 'Ошибка при создании зависимости' });
    }
  },

  async removeDependency(req: Request, res: Response) {
    try {
      const { depId } = req.params;
      const result = await depRepo().delete(depId);
      if (result.affected === 0) return res.status(404).json({ error: 'Зависимость не найдена' });
      res.json({ message: 'Зависимость удалена' });
    } catch (error) {
      console.error('Ошибка при удалении зависимости:', error);
      res.status(500).json({ error: 'Ошибка при удалении зависимости' });
    }
  },

  async exportProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await projectRepo().findOne({ where: { id } });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const tasks = await taskRepo().find({
        where: { project_id: id },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });

      const taskIds = tasks.map(t => t.id);
      let dependencies: TaskDependency[] = [];
      if (taskIds.length > 0) {
        dependencies = await depRepo()
          .createQueryBuilder('d')
          .where('d.predecessor_id IN (:...ids) OR d.successor_id IN (:...ids)', { ids: taskIds })
          .getMany();
      }

      // Build ref map: uuid -> task-N
      const refMap = new Map<string, string>();
      tasks.forEach((t, i) => refMap.set(t.id, `task-${i + 1}`));

      const exportData = {
        _format: 'ximi4ka-project-v1',
        name: project.name,
        description: project.description,
        budget: Number(project.budget),
        start_date: project.start_date,
        end_date: project.end_date,
        deliverables: project.deliverables,
        status: project.status,
        tasks: tasks.map(t => ({
          _ref: refMap.get(t.id),
          title: t.title,
          description: t.description,
          priority: t.priority,
          start_date: t.start_date,
          due_date: t.due_date,
          progress: t.progress || 0,
          parent_ref: t.parent_id ? refMap.get(t.parent_id) || null : null,
        })),
        dependencies: dependencies.map(d => ({
          predecessor_ref: refMap.get(d.predecessor_id) || null,
          successor_ref: refMap.get(d.successor_id) || null,
          is_blocking: d.is_blocking,
        })),
      };

      res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.json"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(exportData);
    } catch (error) {
      console.error('Ошибка при экспорте проекта:', error);
      res.status(500).json({ error: 'Ошибка при экспорте проекта' });
    }
  },

  async getTemplate(_req: Request, res: Response) {
    const template = {
      _format: 'ximi4ka-project-v1',
      _instruction: [
        'Шаблон проекта XimFinance.',
        'Заполните поля ниже и импортируйте файл через интерфейс.',
        '',
        'Правила:',
        '- name (обязательно): название проекта',
        '- description: описание проекта или null',
        '- budget: число (бюджет в рублях), по умолчанию 0',
        '- start_date / end_date: дата в формате "YYYY-MM-DD" или null',
        '- deliverables: описание результатов или null',
        '- status: одно из значений — "draft", "active", "on_hold", "completed", "cancelled"',
        '',
        'Задачи (tasks):',
        '- _ref (обязательно): уникальный идентификатор задачи внутри файла (например "task-1", "task-2")',
        '- title (обязательно): название задачи',
        '- description: описание или null',
        '- priority: "high", "medium" или "low" (по умолчанию "medium")',
        '- start_date / due_date: даты в формате "YYYY-MM-DD" или null',
        '- progress: число от 0 до 100 (процент выполнения)',
        '- parent_ref: _ref родительской задачи или null (для подзадач)',
        '',
        'Зависимости (dependencies):',
        '- predecessor_ref: _ref задачи-предшественника',
        '- successor_ref: _ref задачи, которая зависит от предшественника',
        '- is_blocking: true если зависимость блокирующая, false если нет',
      ].join('\n'),
      name: 'Название проекта',
      description: null,
      budget: 0,
      start_date: null,
      end_date: null,
      deliverables: null,
      status: 'draft',
      tasks: [
        {
          _ref: 'task-1',
          title: 'Первая задача',
          description: null,
          priority: 'medium',
          start_date: '2026-05-01',
          due_date: '2026-05-15',
          progress: 0,
          parent_ref: null,
        },
        {
          _ref: 'task-2',
          title: 'Подзадача первой задачи',
          description: 'Пример подзадачи',
          priority: 'high',
          start_date: '2026-05-01',
          due_date: '2026-05-07',
          progress: 0,
          parent_ref: 'task-1',
        },
        {
          _ref: 'task-3',
          title: 'Вторая задача (после первой)',
          description: null,
          priority: 'low',
          start_date: '2026-05-16',
          due_date: '2026-05-31',
          progress: 0,
          parent_ref: null,
        },
      ],
      dependencies: [
        {
          predecessor_ref: 'task-1',
          successor_ref: 'task-3',
          is_blocking: false,
        },
      ],
    };

    res.setHeader('Content-Disposition', 'attachment; filename="project_template.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(template);
  },

  // ---- Checklist ----

  async addChecklistItem(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await taskRepo().findOne({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const { title, sort_order } = req.body;
      if (!title) return res.status(400).json({ error: 'title обязателен' });

      const item = checklistRepo().create({
        task_id: taskId,
        title,
        is_checked: false,
        sort_order: sort_order ?? 0,
      });
      const saved = await checklistRepo().save(item);
      await recalcProgress(taskId);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при добавлении пункта чеклиста:', error);
      res.status(500).json({ error: 'Ошибка при добавлении пункта чеклиста' });
    }
  },

  async updateChecklistItem(req: Request, res: Response) {
    try {
      const { itemId, taskId } = req.params;
      const item = await checklistRepo().findOne({ where: { id: itemId, task_id: taskId } });
      if (!item) return res.status(404).json({ error: 'Пункт чеклиста не найден' });

      const { title, is_checked, sort_order } = req.body;
      if (title !== undefined) item.title = title;
      if (is_checked !== undefined) item.is_checked = is_checked;
      if (sort_order !== undefined) item.sort_order = sort_order;

      const saved = await checklistRepo().save(item);
      await recalcProgress(taskId);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении пункта чеклиста:', error);
      res.status(500).json({ error: 'Ошибка при обновлении пункта чеклиста' });
    }
  },

  async deleteChecklistItem(req: Request, res: Response) {
    try {
      const { itemId, taskId } = req.params;
      const result = await checklistRepo().delete({ id: itemId, task_id: taskId });
      if (result.affected === 0) return res.status(404).json({ error: 'Пункт чеклиста не найден' });
      await recalcProgress(taskId);
      res.json({ message: 'Пункт чеклиста удалён' });
    } catch (error) {
      console.error('Ошибка при удалении пункта чеклиста:', error);
      res.status(500).json({ error: 'Ошибка при удалении пункта чеклиста' });
    }
  },

  // ---- Comments ----

  async getComments(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await taskRepo().findOne({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const comments = await commentRepo().find({
        where: { task_id: taskId },
        order: { created_at: 'ASC' },
      });
      res.json(comments);
    } catch (error) {
      console.error('Ошибка при получении комментариев:', error);
      res.status(500).json({ error: 'Ошибка при получении комментариев' });
    }
  },

  async addComment(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const task = await taskRepo().findOne({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const { text, attachment_url, attachment_name } = req.body;
      if (!text) return res.status(400).json({ error: 'text обязателен' });

      const comment = commentRepo().create({
        task_id: taskId,
        author_id: (req as any).user.userId,
        text,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
      });
      const saved = await commentRepo().save(comment);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при добавлении комментария:', error);
      res.status(500).json({ error: 'Ошибка при добавлении комментария' });
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      const { commentId, taskId } = req.params;
      const comment = await commentRepo().findOne({ where: { id: commentId, task_id: taskId } });
      if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

      if (comment.author_id !== (req as any).user.userId) {
        return res.status(403).json({ error: 'Нет прав для удаления этого комментария' });
      }

      await commentRepo().delete(commentId);
      res.json({ message: 'Комментарий удалён' });
    } catch (error) {
      console.error('Ошибка при удалении комментария:', error);
      res.status(500).json({ error: 'Ошибка при удалении комментария' });
    }
  },

  // ---- Team Members ----

  async getMembers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const members = await memberRepo().find({
        where: { project_id: id },
        relations: ['employee'],
        order: { created_at: 'ASC' },
      });
      res.json(members);
    } catch (error) {
      console.error('Ошибка при получении участников проекта:', error);
      res.status(500).json({ error: 'Ошибка при получении участников проекта' });
    }
  },

  async addMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { employee_id, role } = req.body;
      if (!employee_id) return res.status(400).json({ error: 'employee_id обязателен' });

      const project = await projectRepo().findOne({ where: { id } });
      if (!project) return res.status(404).json({ error: 'Проект не найден' });

      const existing = await memberRepo().findOne({ where: { project_id: id, employee_id } });
      if (existing) return res.status(409).json({ error: 'Сотрудник уже является участником проекта' });

      const member = memberRepo().create({
        project_id: id,
        employee_id,
        role: role || null,
      });
      const saved = await memberRepo().save(member);
      const withEmployee = await memberRepo().findOne({
        where: { id: saved.id },
        relations: ['employee'],
      });
      res.status(201).json(withEmployee);
    } catch (error) {
      console.error('Ошибка при добавлении участника проекта:', error);
      res.status(500).json({ error: 'Ошибка при добавлении участника проекта' });
    }
  },

  async removeMember(req: Request, res: Response) {
    try {
      const { memberId } = req.params;
      const result = await memberRepo().delete(memberId);
      if (result.affected === 0) return res.status(404).json({ error: 'Участник не найден' });
      res.json({ message: 'Участник удалён из проекта' });
    } catch (error) {
      console.error('Ошибка при удалении участника проекта:', error);
      res.status(500).json({ error: 'Ошибка при удалении участника проекта' });
    }
  },

  async importProject(req: Request, res: Response) {
    try {
      const { department_id, data } = req.body;
      if (!department_id || !data) {
        return res.status(400).json({ error: 'department_id и data обязательны' });
      }
      if (!data.name) {
        return res.status(400).json({ error: 'Поле name обязательно в JSON' });
      }

      // Create project
      const project = projectRepo().create({
        department_id,
        name: data.name,
        description: data.description || null,
        budget: data.budget || 0,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        deliverables: data.deliverables || null,
        status: data.status || 'draft',
        created_by: req.user!.userId,
      });
      const savedProject: Project = await projectRepo().save(project) as any;

      // Create tasks and build ref -> uuid map
      const refToId = new Map<string, string>();
      const tasksToCreate = (data.tasks || []) as Array<{
        _ref: string;
        title: string;
        description?: string;
        priority?: string;
        start_date?: string;
        due_date?: string;
        progress?: number;
        parent_ref?: string;
      }>;

      // First pass: create tasks without parent_id
      for (const t of tasksToCreate) {
        if (!t._ref || !t.title) continue;
        const task = taskRepo().create({
          project_id: savedProject.id,
          title: t.title,
          description: t.description || null,
          priority: t.priority || 'medium',
          start_date: t.start_date || null,
          due_date: t.due_date || null,
          progress: t.progress || 0,
          created_by: req.user!.userId,
        } as any);
        const saved: Task = await taskRepo().save(task) as any;
        refToId.set(t._ref, saved.id);
      }

      // Second pass: set parent_id for subtasks
      for (const t of tasksToCreate) {
        if (!t._ref || !t.parent_ref) continue;
        const taskId = refToId.get(t._ref);
        const parentId = refToId.get(t.parent_ref);
        if (taskId && parentId) {
          await taskRepo().update(taskId, { parent_id: parentId });
        }
      }

      // Create dependencies
      const depsToCreate = (data.dependencies || []) as Array<{
        predecessor_ref: string;
        successor_ref: string;
        is_blocking?: boolean;
      }>;
      for (const d of depsToCreate) {
        const predId = refToId.get(d.predecessor_ref);
        const succId = refToId.get(d.successor_ref);
        if (predId && succId) {
          const dep = depRepo().create({
            predecessor_id: predId,
            successor_id: succId,
            type: 'finish_to_start',
            is_blocking: d.is_blocking || false,
          });
          await depRepo().save(dep);
        }
      }

      res.status(201).json({ id: savedProject.id, message: 'Проект импортирован' });
    } catch (error) {
      console.error('Ошибка при импорте проекта:', error);
      res.status(500).json({ error: 'Ошибка при импорте проекта' });
    }
  },
};
