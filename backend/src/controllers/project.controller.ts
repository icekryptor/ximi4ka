import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Project } from '../entities/Project';
import { Task } from '../entities/Task';
import { TaskDependency } from '../entities/TaskDependency';

const projectRepo = () => AppDataSource.getRepository(Project);
const taskRepo = () => AppDataSource.getRepository(Task);
const depRepo = () => AppDataSource.getRepository(TaskDependency);

export const projectController = {
  async getAll(req: Request, res: Response) {
    try {
      const where: any = {};
      if (req.query.department_id) where.department_id = req.query.department_id;
      if (req.query.status) where.status = req.query.status;

      const projects = await projectRepo().find({
        where,
        relations: ['department'],
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
        relations: ['department'],
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

      res.json({ ...project, tasks, dependencies });
    } catch (error) {
      console.error('Ошибка при получении проекта:', error);
      res.status(500).json({ error: 'Ошибка при получении проекта' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { department_id, name, description, budget, start_date, end_date, deliverables, status } = req.body;
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

      const { name, description, budget, start_date, end_date, deliverables, status } = req.body;
      if (name !== undefined) project.name = name;
      if (description !== undefined) project.description = description;
      if (budget !== undefined) project.budget = budget;
      if (start_date !== undefined) project.start_date = start_date;
      if (end_date !== undefined) project.end_date = end_date;
      if (deliverables !== undefined) project.deliverables = deliverables;
      if (status !== undefined) project.status = status;

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
};
