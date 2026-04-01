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
