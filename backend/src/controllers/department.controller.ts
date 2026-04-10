import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Department } from '../entities/Department';
import { DepartmentRole } from '../entities/DepartmentRole';
import { Board } from '../entities/Board';
import { RecurringTask } from '../entities/RecurringTask';

const deptRepo = () => AppDataSource.getRepository(Department);
const roleRepo = () => AppDataSource.getRepository(DepartmentRole);
const boardRepo = () => AppDataSource.getRepository(Board);
const recurringRepo = () => AppDataSource.getRepository(RecurringTask);

export const departmentController = {
  async getAll(req: Request, res: Response) {
    try {
      const departments = await deptRepo().find({
        order: { sort_order: 'ASC' },
      });

      const enriched = await Promise.all(
        departments.map(async (dept) => {
          const boardCount = await boardRepo().count({
            where: { department_id: dept.id, is_archived: false },
          });
          const memberCount = await roleRepo().count({
            where: { department_id: dept.id },
          });
          const recurringCount = await recurringRepo().count({
            where: { department_id: dept.id, is_active: true },
          });
          return {
            ...dept,
            board_count: boardCount,
            member_count: memberCount,
            project_count: 0,
            recurring_task_count: recurringCount,
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error('Ошибка при получении направлений:', error);
      res.status(500).json({ error: 'Ошибка при получении направлений' });
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const department = await deptRepo().findOne({ where: { id } });
      if (!department) return res.status(404).json({ error: 'Направление не найдено' });

      const boards = await boardRepo().find({
        where: { department_id: id, is_archived: false },
        order: { sort_order: 'ASC' },
      });

      const members = await roleRepo().find({
        where: { department_id: id },
        relations: ['user'],
      });

      res.json({ ...department, boards, members });
    } catch (error) {
      console.error('Ошибка при получении направления:', error);
      res.status(500).json({ error: 'Ошибка при получении направления' });
    }
  },

  async getMembers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const members = await roleRepo().find({
        where: { department_id: id },
        relations: ['user'],
      });
      res.json(members);
    } catch (error) {
      console.error('Ошибка при получении участников:', error);
      res.status(500).json({ error: 'Ошибка при получении участников' });
    }
  },

  async addMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { user_id, role } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id обязателен' });

      const validRoles = ['head', 'member', 'viewer'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Недопустимая роль' });
      }

      const existing = await roleRepo().findOne({
        where: { user_id, department_id: id },
      });
      if (existing) {
        existing.role = role || existing.role;
        const saved = await roleRepo().save(existing);
        return res.json(saved);
      }

      const member = roleRepo().create({
        user_id,
        department_id: id,
        role: role || 'member',
      });
      const saved = await roleRepo().save(member);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при добавлении участника:', error);
      res.status(500).json({ error: 'Ошибка при добавлении участника' });
    }
  },

  async removeMember(req: Request, res: Response) {
    try {
      const { id, userId } = req.params;
      const result = await roleRepo().delete({ department_id: id, user_id: userId });
      if (result.affected === 0) return res.status(404).json({ error: 'Участник не найден' });
      res.json({ message: 'Участник удалён' });
    } catch (error) {
      console.error('Ошибка при удалении участника:', error);
      res.status(500).json({ error: 'Ошибка при удалении участника' });
    }
  },

  async assignBoard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { board_id } = req.body;
      if (!board_id) return res.status(400).json({ error: 'board_id обязателен' });

      const board = await boardRepo().findOne({ where: { id: board_id } });
      if (!board) return res.status(404).json({ error: 'Доска не найдена' });

      board.department_id = id;
      const saved = await boardRepo().save(board);
      res.json(saved);
    } catch (error) {
      console.error('Ошибка при привязке доски:', error);
      res.status(500).json({ error: 'Ошибка при привязке доски' });
    }
  },
};
