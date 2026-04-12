import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Employee } from '../entities/Employee';
import { Project } from '../entities/Project';
import { ProjectMember } from '../entities/ProjectMember';
import { Task, TaskColumn, TaskPriority } from '../entities/Task';
import { TaskChecklistItem } from '../entities/TaskChecklistItem';
import { TaskComment } from '../entities/TaskComment';
import { TaskDependency } from '../entities/TaskDependency';
import { eventBus } from '../services/event-bus';

// ---------------------------------------------------------------------------
// Repository helpers
// ---------------------------------------------------------------------------

const projectRepo = () => AppDataSource.getRepository(Project);
const memberRepo = () => AppDataSource.getRepository(ProjectMember);
const taskRepo = () => AppDataSource.getRepository(Task);
const depRepo = () => AppDataSource.getRepository(TaskDependency);
const checklistRepo = () => AppDataSource.getRepository(TaskChecklistItem);
const commentRepo = () => AppDataSource.getRepository(TaskComment);
const employeeRepo = () => AppDataSource.getRepository(Employee);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function recalcProgress(taskId: string): Promise<void> {
  const items = await checklistRepo().find({ where: { task_id: taskId } });
  if (items.length === 0) return;
  const checked = items.filter(i => i.is_checked).length;
  const progress = Math.round((checked / items.length) * 100);
  await taskRepo().update(taskId, { progress });
}

/**
 * Fetch and return a task; returns null when the task is not found or does not
 * belong to the given project.
 */
async function findTaskInProject(taskId: string, projectId: string): Promise<Task | null> {
  const task = await taskRepo().findOne({ where: { id: taskId } });
  if (!task || task.project_id !== projectId) return null;
  return task;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export const publicProjectController = {

  // GET /api/public/projects/:id
  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const project = await projectRepo().findOne({
        where: { id },
        relations: ['department', 'responsible'],
      });
      if (!project) {
        res.status(404).json({ error: 'Проект не найден' });
        return;
      }

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

      const checklistItems = taskIds.length > 0
        ? await checklistRepo().find({
            where: { task_id: In(taskIds) },
            order: { sort_order: 'ASC', created_at: 'ASC' },
          })
        : [];

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
      console.error('Ошибка при получении проекта (public):', error);
      res.status(500).json({ error: 'Ошибка при получении проекта' });
    }
  },

  // PUT /api/public/projects/:id  (responsible only)
  async updateProject(req: Request, res: Response): Promise<void> {
    try {
      if (req.telegramAuth!.role !== 'responsible') {
        res.status(403).json({ error: 'Только ответственный может изменять проект' });
        return;
      }

      const { id } = req.params;
      const project = await projectRepo().findOne({ where: { id } });
      if (!project) {
        res.status(404).json({ error: 'Проект не найден' });
        return;
      }

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
      console.error('Ошибка при обновлении проекта (public):', error);
      res.status(500).json({ error: 'Ошибка при обновлении проекта' });
    }
  },

  // POST /api/public/projects/:id/tasks  (responsible only)
  async addTask(req: Request, res: Response): Promise<void> {
    try {
      if (req.telegramAuth!.role !== 'responsible') {
        res.status(403).json({ error: 'Только ответственный может создавать задачи' });
        return;
      }

      const { id } = req.params;
      const project = await projectRepo().findOne({ where: { id } });
      if (!project) {
        res.status(404).json({ error: 'Проект не найден' });
        return;
      }

      const { title, description, assignee_id, start_date, due_date, parent_id, priority, board_id } = req.body;
      if (!title) {
        res.status(400).json({ error: 'title обязателен' });
        return;
      }

      const task = taskRepo().create({
        project_id: id,
        board_id: board_id || null,
        title,
        description: description || null,
        assignee_id: assignee_id || null,
        start_date: start_date || null,
        due_date: due_date || null,
        parent_id: parent_id || null,
        priority: (priority as TaskPriority) || TaskPriority.MEDIUM,
        progress: 0,
        created_by: req.telegramAuth!.employeeId,
      });
      const saved = await taskRepo().save(task);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании задачи (public):', error);
      res.status(500).json({ error: 'Ошибка при создании задачи' });
    }
  },

  // PATCH /api/public/projects/:id/tasks/:taskId
  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const { role, employeeId } = req.telegramAuth!;
      const { id: projectId, taskId } = req.params;

      const task = await findTaskInProject(taskId, projectId);
      if (!task) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      if (role === 'member' && task.assignee_id !== employeeId) {
        res.status(403).json({ error: 'Можно редактировать только свои задачи' });
        return;
      }

      const oldAssigneeId = task.assignee_id;
      const oldProgress = task.progress || 0;
      const oldColumn = task.column;

      if (role === 'responsible') {
        // Full update access
        const {
          title,
          description,
          assignee_id,
          start_date,
          due_date,
          progress,
          column,
          priority,
          parent_id,
        } = req.body;

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (assignee_id !== undefined) task.assignee_id = assignee_id;
        if (start_date !== undefined) task.start_date = start_date;
        if (due_date !== undefined) task.due_date = due_date;
        if (progress !== undefined) task.progress = progress;
        if (column !== undefined) task.column = column as TaskColumn;
        if (priority !== undefined) task.priority = priority as TaskPriority;
        if (parent_id !== undefined) task.parent_id = parent_id;
      } else {
        // Member — limited to progress and column only
        const { progress, column } = req.body;
        if (progress !== undefined) task.progress = progress;
        if (column !== undefined) task.column = column as TaskColumn;
      }

      const saved = await taskRepo().save(task);

      // Emit Telegram events (fire-and-forget)
      if (task.project_id) {
        const project = await projectRepo().findOne({ where: { id: task.project_id } });
        const projectName = project?.name || '';

        // Task assigned (only responsible can change assignee)
        if (role === 'responsible' && req.body.assignee_id !== undefined && req.body.assignee_id !== oldAssigneeId) {
          const assignee = task.assignee_id
            ? await employeeRepo().findOne({ where: { id: task.assignee_id } })
            : null;
          eventBus.emitEvent('task.assigned', {
            projectId: task.project_id,
            projectName,
            taskId: task.id,
            taskTitle: task.title,
            assigneeName: assignee?.name,
            priority: task.priority,
            dueDate: task.due_date,
          });
        }

        // Task completed
        if (
          (req.body.progress === 100 || req.body.column === 'done') &&
          oldProgress < 100 &&
          oldColumn !== 'done'
        ) {
          const assignee = task.assignee_id
            ? await employeeRepo().findOne({ where: { id: task.assignee_id } })
            : null;
          eventBus.emitEvent('task.completed', {
            projectId: task.project_id,
            projectName,
            taskId: task.id,
            taskTitle: task.title,
            assigneeName: assignee?.name,
          });
        }

        // Status (column) changed
        if (req.body.column !== undefined && req.body.column !== oldColumn) {
          eventBus.emitEvent('task.status_changed', {
            projectId: task.project_id,
            projectName,
            taskId: task.id,
            taskTitle: task.title,
            oldColumn,
            newColumn: req.body.column,
          });
        }
      }

      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении задачи (public):', error);
      res.status(500).json({ error: 'Ошибка при обновлении задачи' });
    }
  },

  // GET /api/public/projects/:id/tasks/:taskId/comments
  async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { id: projectId, taskId } = req.params;

      const task = await findTaskInProject(taskId, projectId);
      if (!task) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      const comments = await commentRepo().find({
        where: { task_id: taskId },
        order: { created_at: 'ASC' },
      });
      res.json(comments);
    } catch (error) {
      console.error('Ошибка при получении комментариев (public):', error);
      res.status(500).json({ error: 'Ошибка при получении комментариев' });
    }
  },

  // POST /api/public/projects/:id/tasks/:taskId/comments
  async addComment(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = req.telegramAuth!;
      const { id: projectId, taskId } = req.params;

      const task = await findTaskInProject(taskId, projectId);
      if (!task) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      const { text, attachment_url, attachment_name } = req.body;
      if (!text) {
        res.status(400).json({ error: 'text обязателен' });
        return;
      }

      const comment = commentRepo().create({
        task_id: taskId,
        author_id: employeeId,
        text,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
      });
      const saved = await commentRepo().save(comment);

      // Emit for Telegram (fire-and-forget)
      if (task.project_id) {
        const project = await projectRepo().findOne({ where: { id: task.project_id } });
        eventBus.emitEvent('task.comment_added', {
          projectId: task.project_id,
          projectName: project?.name || '',
          taskId: task.id,
          taskTitle: task.title,
          authorId: employeeId,
          text,
          attachmentUrl: attachment_url,
        });
      }

      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при добавлении комментария (public):', error);
      res.status(500).json({ error: 'Ошибка при добавлении комментария' });
    }
  },

  // PATCH /api/public/projects/:id/tasks/:taskId/checklist/:itemId
  async updateChecklistItem(req: Request, res: Response): Promise<void> {
    try {
      const { role, employeeId } = req.telegramAuth!;
      const { id: projectId, taskId, itemId } = req.params;

      // Verify the task belongs to this project
      const task = await findTaskInProject(taskId, projectId);
      if (!task) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      // Members can only act on their own tasks
      if (role === 'member' && task.assignee_id !== employeeId) {
        res.status(403).json({ error: 'Можно редактировать только чеклисты своих задач' });
        return;
      }

      const item = await checklistRepo().findOne({ where: { id: itemId, task_id: taskId } });
      if (!item) {
        res.status(404).json({ error: 'Пункт чеклиста не найден' });
        return;
      }

      const { is_checked, title, sort_order } = req.body;
      if (is_checked !== undefined) item.is_checked = is_checked;
      if (title !== undefined) item.title = title;
      if (sort_order !== undefined) item.sort_order = sort_order;

      const saved = await checklistRepo().save(item);
      await recalcProgress(taskId);

      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении пункта чеклиста (public):', error);
      res.status(500).json({ error: 'Ошибка при обновлении пункта чеклиста' });
    }
  },

  // POST /api/public/projects/:id/members  (responsible only)
  async addMember(req: Request, res: Response): Promise<void> {
    try {
      if (req.telegramAuth!.role !== 'responsible') {
        res.status(403).json({ error: 'Только ответственный может добавлять участников' });
        return;
      }

      const { id } = req.params;
      const { employee_id, role } = req.body;
      if (!employee_id) {
        res.status(400).json({ error: 'employee_id обязателен' });
        return;
      }

      const project = await projectRepo().findOne({ where: { id } });
      if (!project) {
        res.status(404).json({ error: 'Проект не найден' });
        return;
      }

      const existing = await memberRepo().findOne({
        where: { project_id: id, employee_id },
      });
      if (existing) {
        res.status(409).json({ error: 'Сотрудник уже является участником проекта' });
        return;
      }

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

      // Emit for Telegram (fire-and-forget)
      const emp = await employeeRepo().findOne({ where: { id: employee_id } });
      if (project && emp) {
        eventBus.emitEvent('project.member_added', {
          projectId: id,
          projectName: project.name,
          employeeName: emp.name,
          role,
        });
      }

      res.status(201).json(withEmployee);
    } catch (error) {
      console.error('Ошибка при добавлении участника (public):', error);
      res.status(500).json({ error: 'Ошибка при добавлении участника' });
    }
  },

  // DELETE /api/public/projects/:id/members/:memberId  (responsible only)
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      if (req.telegramAuth!.role !== 'responsible') {
        res.status(403).json({ error: 'Только ответственный может удалять участников' });
        return;
      }

      const { memberId } = req.params;
      const result = await memberRepo().delete(memberId);
      if (result.affected === 0) {
        res.status(404).json({ error: 'Участник не найден' });
        return;
      }

      res.json({ message: 'Участник удалён из проекта' });
    } catch (error) {
      console.error('Ошибка при удалении участника (public):', error);
      res.status(500).json({ error: 'Ошибка при удалении участника' });
    }
  },
};
