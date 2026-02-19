import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Counterparty } from '../entities/Counterparty';
import { Like } from 'typeorm';

const counterpartyRepository = AppDataSource.getRepository(Counterparty);

export const counterpartyController = {
  // Получить всех контрагентов
  async getAll(req: Request, res: Response) {
    try {
      const { type, search, active } = req.query;
      
      let where: any = {};
      
      if (type) where.type = type;
      if (active !== undefined) where.is_active = active === 'true';
      if (search) {
        where.name = Like(`%${search}%`);
      }

      const counterparties = await counterpartyRepository.find({
        where,
        order: { name: 'ASC' }
      });

      res.json(counterparties);
    } catch (error) {
      console.error('Ошибка при получении контрагентов:', error);
      res.status(500).json({ error: 'Ошибка при получении контрагентов' });
    }
  },

  // Получить контрагента по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const counterparty = await counterpartyRepository.findOne({ where: { id } });

      if (!counterparty) {
        return res.status(404).json({ error: 'Контрагент не найден' });
      }

      res.json(counterparty);
    } catch (error) {
      console.error('Ошибка при получении контрагента:', error);
      res.status(500).json({ error: 'Ошибка при получении контрагента' });
    }
  },

  // Создать контрагента
  async create(req: Request, res: Response) {
    try {
      const counterparty = counterpartyRepository.create(req.body);
      const savedCounterparty = await counterpartyRepository.save(counterparty);
      res.status(201).json(savedCounterparty);
    } catch (error) {
      console.error('Ошибка при создании контрагента:', error);
      res.status(500).json({ error: 'Ошибка при создании контрагента' });
    }
  },

  // Обновить контрагента
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const counterparty = await counterpartyRepository.findOne({ where: { id } });

      if (!counterparty) {
        return res.status(404).json({ error: 'Контрагент не найден' });
      }

      await counterpartyRepository.update(id, req.body);
      const updatedCounterparty = await counterpartyRepository.findOne({ where: { id } });

      res.json(updatedCounterparty);
    } catch (error) {
      console.error('Ошибка при обновлении контрагента:', error);
      res.status(500).json({ error: 'Ошибка при обновлении контрагента' });
    }
  },

  // Удалить контрагента
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await counterpartyRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Контрагент не найден' });
      }

      res.json({ message: 'Контрагент удален' });
    } catch (error) {
      console.error('Ошибка при удалении контрагента:', error);
      res.status(500).json({ error: 'Ошибка при удалении контрагента' });
    }
  }
};
