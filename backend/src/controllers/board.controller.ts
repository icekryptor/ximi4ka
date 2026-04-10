import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Board } from '../entities/Board';

const repo = () => AppDataSource.getRepository(Board);

export const boardController = {
  async getAll(req: Request, res: Response) {
    try {
      const where: any = { is_archived: false };
      if (req.query.department_id) {
        where.department_id = req.query.department_id;
      }
      const boards = await repo().find({
        where,
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
      const { name, description, color, department_id } = req.body;
      if (!name) return res.status(400).json({ error: 'Название обязательно' });

      const maxSort = await repo()
        .createQueryBuilder('b')
        .select('COALESCE(MAX(b.sort_order), 0)', 'max')
        .getRawOne();

      const board = repo().create({
        name,
        description: description || null,
        color: color || null,
        department_id: department_id || null,
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
