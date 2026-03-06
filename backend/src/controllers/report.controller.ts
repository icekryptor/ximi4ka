import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction, TransactionType } from '../entities/Transaction';

const transactionRepository = AppDataSource.getRepository(Transaction);

export const reportController = {
  // Сводка по финансам — SQL aggregation
  async getSummary(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const qb = transactionRepository
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('SUM(t.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.type');

      if (startDate && endDate) {
        qb.where('t.date BETWEEN :startDate AND :endDate', {
          startDate: startDate as string,
          endDate: endDate as string,
        });
      }

      const rows: { type: string; total: string; count: string }[] = await qb.getRawMany();

      let income = 0;
      let expense = 0;
      let transactionCount = 0;

      for (const row of rows) {
        const amount = Number(row.total) || 0;
        const count = Number(row.count) || 0;
        transactionCount += count;
        if (row.type === TransactionType.INCOME) income = amount;
        else expense = amount;
      }

      res.json({
        income,
        expense,
        balance: income - expense,
        transactionCount,
        period: {
          startDate: startDate || 'Не указано',
          endDate: endDate || 'Не указано',
        },
      });
    } catch (error) {
      console.error('Ошибка при получении сводки:', error);
      res.status(500).json({ error: 'Ошибка при получении сводки' });
    }
  },

  // Отчет по категориям — SQL aggregation with JOIN
  async getByCategory(req: Request, res: Response) {
    try {
      const { startDate, endDate, type } = req.query;

      const qb = transactionRepository
        .createQueryBuilder('t')
        .leftJoin('t.category', 'c')
        .select("COALESCE(c.name, 'Без категории')", 'name')
        .addSelect('SUM(t.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .groupBy("COALESCE(c.name, 'Без категории')")
        .orderBy('SUM(t.amount)', 'DESC');

      if (startDate && endDate) {
        qb.where('t.date BETWEEN :startDate AND :endDate', {
          startDate: startDate as string,
          endDate: endDate as string,
        });
      }
      if (type) {
        qb.andWhere('t.type = :type', { type: type as string });
      }

      const rows: { name: string; total: string; count: string }[] = await qb.getRawMany();

      const report = rows.map((row) => ({
        name: row.name,
        total: Number(row.total) || 0,
        count: Number(row.count) || 0,
      }));

      res.json(report);
    } catch (error) {
      console.error('Ошибка при получении отчета по категориям:', error);
      res.status(500).json({ error: 'Ошибка при получении отчета по категориям' });
    }
  },

  // Отчет по контрагентам — SQL aggregation with JOIN
  async getByCounterparty(req: Request, res: Response) {
    try {
      const { startDate, endDate, type } = req.query;

      const qb = transactionRepository
        .createQueryBuilder('t')
        .leftJoin('t.counterparty', 'cp')
        .select("COALESCE(cp.name, 'Без контрагента')", 'name')
        .addSelect('SUM(t.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .groupBy("COALESCE(cp.name, 'Без контрагента')")
        .orderBy('SUM(t.amount)', 'DESC');

      if (startDate && endDate) {
        qb.where('t.date BETWEEN :startDate AND :endDate', {
          startDate: startDate as string,
          endDate: endDate as string,
        });
      }
      if (type) {
        qb.andWhere('t.type = :type', { type: type as string });
      }

      const rows: { name: string; total: string; count: string }[] = await qb.getRawMany();

      const report = rows.map((row) => ({
        name: row.name,
        total: Number(row.total) || 0,
        count: Number(row.count) || 0,
      }));

      res.json(report);
    } catch (error) {
      console.error('Ошибка при получении отчета по контрагентам:', error);
      res.status(500).json({ error: 'Ошибка при получении отчета по контрагентам' });
    }
  },
};
