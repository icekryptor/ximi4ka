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
