import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { SalesChannel } from '../entities/SalesChannel';

const repo = AppDataSource.getRepository(SalesChannel);

export const salesChannelController = {
  async getAll(req: Request, res: Response) {
    try {
      const channels = await repo.find({ order: { name: 'ASC' } });
      res.json(channels);
    } catch (error) {
      console.error('Ошибка при получении каналов продаж:', error);
      res.status(500).json({ error: 'Ошибка при получении каналов продаж' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const channel = await repo.findOne({ where: { id: req.params.id } });
      if (!channel) return res.status(404).json({ error: 'Канал продаж не найден' });
      res.json(channel);
    } catch (error) {
      console.error('Ошибка при получении канала продаж:', error);
      res.status(500).json({ error: 'Ошибка при получении канала продаж' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const channel = repo.create(req.body);
      const result = await repo.save(channel);
      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка при создании канала продаж:', error);
      res.status(500).json({ error: 'Ошибка при создании канала продаж' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await repo.findOne({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Канал продаж не найден' });

      await repo.update(id, req.body);
      const updated = await repo.findOne({ where: { id } });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении канала продаж:', error);
      res.status(500).json({ error: 'Ошибка при обновлении канала продаж' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Канал продаж не найден' });
      res.json({ message: 'Канал продаж удалён' });
    } catch (error) {
      console.error('Ошибка при удалении канала продаж:', error);
      res.status(500).json({ error: 'Ошибка при удалении канала продаж' });
    }
  },
};
