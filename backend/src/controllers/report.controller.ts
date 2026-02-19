import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction, TransactionType } from '../entities/Transaction';
import { Between } from 'typeorm';

const transactionRepository = AppDataSource.getRepository(Transaction);

export const reportController = {
  // Сводка по финансам
  async getSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let where: any = {};
      
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      }

      const transactions = await transactionRepository.find({ where });

      const income = transactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = income - expense;

      res.json({
        income,
        expense,
        balance,
        transactionCount: transactions.length,
        period: {
          startDate: startDate || 'Не указано',
          endDate: endDate || 'Не указано'
        }
      });
    } catch (error) {
      console.error('Ошибка при получении сводки:', error);
      res.status(500).json({ error: 'Ошибка при получении сводки' });
    }
  },

  // Отчет по категориям
  async getByCategory(req: Request, res: Response) {
    try {
      const { startDate, endDate, type } = req.query;
      
      let where: any = {};
      
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      }
      if (type) {
        where.type = type;
      }

      const transactions = await transactionRepository.find({
        where,
        relations: ['category']
      });

      const categoryMap = new Map<string, { name: string; total: number; count: number }>();

      transactions.forEach(t => {
        const categoryName = t.category?.name || 'Без категории';
        const existing = categoryMap.get(categoryName) || { name: categoryName, total: 0, count: 0 };
        
        existing.total += Number(t.amount);
        existing.count += 1;
        
        categoryMap.set(categoryName, existing);
      });

      const report = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

      res.json(report);
    } catch (error) {
      console.error('Ошибка при получении отчета по категориям:', error);
      res.status(500).json({ error: 'Ошибка при получении отчета по категориям' });
    }
  },

  // Отчет по контрагентам
  async getByCounterparty(req: Request, res: Response) {
    try {
      const { startDate, endDate, type } = req.query;
      
      let where: any = {};
      
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      }
      if (type) {
        where.type = type;
      }

      const transactions = await transactionRepository.find({
        where,
        relations: ['counterparty']
      });

      const counterpartyMap = new Map<string, { name: string; total: number; count: number }>();

      transactions.forEach(t => {
        const counterpartyName = t.counterparty?.name || 'Без контрагента';
        const existing = counterpartyMap.get(counterpartyName) || { name: counterpartyName, total: 0, count: 0 };
        
        existing.total += Number(t.amount);
        existing.count += 1;
        
        counterpartyMap.set(counterpartyName, existing);
      });

      const report = Array.from(counterpartyMap.values()).sort((a, b) => b.total - a.total);

      res.json(report);
    } catch (error) {
      console.error('Ошибка при получении отчета по контрагентам:', error);
      res.status(500).json({ error: 'Ошибка при получении отчета по контрагентам' });
    }
  }
};
