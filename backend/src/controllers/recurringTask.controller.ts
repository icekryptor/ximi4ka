import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { RecurringTask } from '../entities/RecurringTask';
import { RecurringTaskReport } from '../entities/RecurringTaskReport';

const taskRepo = () => AppDataSource.getRepository(RecurringTask);
const reportRepo = () => AppDataSource.getRepository(RecurringTaskReport);

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function isDueToday(task: RecurringTask): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  switch (task.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return dayOfWeek === 1;
    case 'monthly':
      return now.getDate() === 1;
    case 'custom':
      return task.frequency_days?.includes(dayOfWeek) ?? false;
    default:
      return false;
  }
}

export const recurringTaskController = {
  async getAll(req: Request, res: Response) {
    try {
      const where: any = { is_active: true };
      if (req.query.department_id) {
        where.department_id = req.query.department_id;
      }

      const tasks = await taskRepo().find({
        where,
        relations: ['assignee', 'department'],
        order: { created_at: 'ASC' },
      });

      const today = getTodayString();
      const todayReports = await reportRepo()
        .createQueryBuilder('r')
        .where('r.report_date = :today', { today })
        .getMany();

      const reportMap = new Map(todayReports.map(r => [r.recurring_task_id, r]));

      const enriched = tasks.map(task => ({
        ...task,
        is_due_today: isDueToday(task),
        today_report: reportMap.get(task.id) || null,
      }));

      res.json(enriched);
    } catch (error) {
      console.error('Ошибка при получении регулярных задач:', error);
      res.status(500).json({ error: 'Ошибка при получении регулярных задач' });
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await taskRepo().findOne({
        where: { id },
        relations: ['assignee', 'department'],
      });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const reports = await reportRepo().find({
        where: { recurring_task_id: id },
        relations: ['author'],
        order: { report_date: 'DESC' },
        take: 30,
      });

      res.json({ ...task, reports });
    } catch (error) {
      console.error('Ошибка при получении задачи:', error);
      res.status(500).json({ error: 'Ошибка при получении задачи' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { department_id, title, instruction, frequency, frequency_days, assignee_id } = req.body;
      if (!department_id || !title) {
        return res.status(400).json({ error: 'department_id и title обязательны' });
      }

      const task = taskRepo().create({
        department_id,
        title,
        instruction: instruction || null,
        frequency: frequency || 'daily',
        frequency_days: frequency_days || null,
        assignee_id: assignee_id || null,
      });
      const saved = await taskRepo().save(task);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании задачи:', error);
      res.status(500).json({ error: 'Ошибка при создании задачи' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const task = await taskRepo().findOne({ where: { id } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const { title, frequency, frequency_days, assignee_id, is_active } = req.body;
      if (title !== undefined) task.title = title;
      if (frequency !== undefined) task.frequency = frequency;
      if (frequency_days !== undefined) task.frequency_days = frequency_days;
      if (assignee_id !== undefined) task.assignee_id = assignee_id;
      if (is_active !== undefined) task.is_active = is_active;

      const saved = await taskRepo().save(task);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
      res.status(500).json({ error: 'Ошибка при обновлении задачи' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await taskRepo().delete(id);
      if (result.affected === 0) return res.status(404).json({ error: 'Задача не найдена' });
      res.json({ message: 'Задача удалена' });
    } catch (error) {
      console.error('Ошибка при удалении задачи:', error);
      res.status(500).json({ error: 'Ошибка при удалении задачи' });
    }
  },

  async submitReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { text, report_date } = req.body;
      if (!text) return res.status(400).json({ error: 'Текст отчёта обязателен' });

      const task = await taskRepo().findOne({ where: { id } });
      if (!task) return res.status(404).json({ error: 'Задача не найдена' });

      const date = report_date || getTodayString();

      const existing = await reportRepo().findOne({
        where: { recurring_task_id: id, report_date: date },
      });
      if (existing) {
        existing.text = text;
        const saved = await reportRepo().save(existing);
        return res.json(saved);
      }

      const report = reportRepo().create({
        recurring_task_id: id,
        author_id: req.user!.userId,
        report_date: date,
        text,
      });
      const saved = await reportRepo().save(report);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при отправке отчёта:', error);
      res.status(500).json({ error: 'Ошибка при отправке отчёта' });
    }
  },

  async getReports(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reports = await reportRepo().find({
        where: { recurring_task_id: id },
        relations: ['author'],
        order: { report_date: 'DESC' },
      });
      res.json(reports);
    } catch (error) {
      console.error('Ошибка при получении отчётов:', error);
      res.status(500).json({ error: 'Ошибка при получении отчётов' });
    }
  },
};
