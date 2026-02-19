import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction } from '../entities/Transaction';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

const transactionRepository = AppDataSource.getRepository(Transaction);

export const transactionController = {
  // Получить все транзакции с фильтрами
  async getAll(req: Request, res: Response) {
    try {
      const { type, startDate, endDate, categoryId, counterpartyId } = req.query;
      
      let where: any = {};
      
      if (type) where.type = type;
      if (categoryId) where.category_id = categoryId;
      if (counterpartyId) where.counterparty_id = counterpartyId;
      
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate as string));
      }

      const transactions = await transactionRepository.find({
        where,
        relations: ['category', 'counterparty'],
        order: { date: 'DESC', created_at: 'DESC' }
      });

      res.json(transactions);
    } catch (error) {
      console.error('Ошибка при получении транзакций:', error);
      res.status(500).json({ error: 'Ошибка при получении транзакций' });
    }
  },

  // Получить транзакцию по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await transactionRepository.findOne({
        where: { id },
        relations: ['category', 'counterparty']
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      res.json(transaction);
    } catch (error) {
      console.error('Ошибка при получении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при получении транзакции' });
    }
  },

  // Создать транзакцию
  async create(req: Request, res: Response) {
    try {
      const transaction = transactionRepository.create(req.body);
      const savedTransaction = await transactionRepository.save(transaction);
      
      const fullTransaction = await transactionRepository.findOne({
        where: { id: savedTransaction.id },
        relations: ['category', 'counterparty']
      });

      res.status(201).json(fullTransaction);
    } catch (error) {
      console.error('Ошибка при создании транзакции:', error);
      res.status(500).json({ error: 'Ошибка при создании транзакции' });
    }
  },

  // Обновить транзакцию
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await transactionRepository.findOne({ where: { id } });

      if (!transaction) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      await transactionRepository.update(id, req.body);
      
      const updatedTransaction = await transactionRepository.findOne({
        where: { id },
        relations: ['category', 'counterparty']
      });

      res.json(updatedTransaction);
    } catch (error) {
      console.error('Ошибка при обновлении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при обновлении транзакции' });
    }
  },

  // Удалить транзакцию
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await transactionRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      res.json({ message: 'Транзакция удалена' });
    } catch (error) {
      console.error('Ошибка при удалении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при удалении транзакции' });
    }
  }
};
