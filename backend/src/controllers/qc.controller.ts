import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { QcChecklist } from '../entities/QcChecklist';
import { QcInspection, InspectionResult } from '../entities/QcInspection';
import { ProductionOrder } from '../entities/ProductionOrder';

const checklistRepo = AppDataSource.getRepository(QcChecklist);
const inspectionRepo = AppDataSource.getRepository(QcInspection);
const orderRepo = AppDataSource.getRepository(ProductionOrder);

export const qcController = {
  // ─── Чек-листы ────────────────────────────────

  async getAllChecklists(req: Request, res: Response) {
    try {
      const { kit_id } = req.query;
      const qb = checklistRepo.createQueryBuilder('cl')
        .leftJoinAndSelect('cl.kit', 'kit')
        .orderBy('cl.created_at', 'DESC');

      if (kit_id) qb.andWhere('cl.kit_id = :kit_id', { kit_id });

      const items = await qb.getMany();
      res.json(items);
    } catch (error) {
      console.error('Ошибка при получении чек-листов:', error);
      res.status(500).json({ error: 'Ошибка при получении чек-листов' });
    }
  },

  async getChecklistById(req: Request, res: Response) {
    try {
      const checklist = await checklistRepo.findOne({
        where: { id: req.params.id },
        relations: ['kit'],
      });
      if (!checklist) return res.status(404).json({ error: 'Чек-лист не найден' });
      res.json(checklist);
    } catch (error) {
      console.error('Ошибка при получении чек-листа:', error);
      res.status(500).json({ error: 'Ошибка при получении чек-листа' });
    }
  },

  async createChecklist(req: Request, res: Response) {
    try {
      const checklist = checklistRepo.create(req.body as Partial<QcChecklist>);
      const saved = await checklistRepo.save(checklist as QcChecklist);
      const result = await checklistRepo.findOne({
        where: { id: saved.id },
        relations: ['kit'],
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка при создании чек-листа:', error);
      res.status(500).json({ error: 'Ошибка при создании чек-листа' });
    }
  },

  async updateChecklist(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await checklistRepo.findOne({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Чек-лист не найден' });

      await checklistRepo.update(id, req.body);
      const updated = await checklistRepo.findOne({ where: { id }, relations: ['kit'] });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении чек-листа:', error);
      res.status(500).json({ error: 'Ошибка при обновлении чек-листа' });
    }
  },

  async deleteChecklist(req: Request, res: Response) {
    try {
      const result = await checklistRepo.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Чек-лист не найден' });
      res.json({ message: 'Чек-лист удалён' });
    } catch (error) {
      console.error('Ошибка при удалении чек-листа:', error);
      res.status(500).json({ error: 'Ошибка при удалении чек-листа' });
    }
  },

  // ─── Проверки (Inspections) ────────────────────

  async getAllInspections(req: Request, res: Response) {
    try {
      const { order_id, result: inspResult } = req.query;
      const qb = inspectionRepo.createQueryBuilder('i')
        .leftJoinAndSelect('i.order', 'order')
        .leftJoinAndSelect('i.checklist', 'checklist')
        .leftJoinAndSelect('i.inspector', 'inspector')
        .leftJoinAndSelect('order.kit', 'kit')
        .orderBy('i.created_at', 'DESC');

      if (order_id) qb.andWhere('i.order_id = :order_id', { order_id });
      if (inspResult) qb.andWhere('i.result = :result', { result: inspResult });

      const items = await qb.getMany();
      res.json(items);
    } catch (error) {
      console.error('Ошибка при получении проверок:', error);
      res.status(500).json({ error: 'Ошибка при получении проверок' });
    }
  },

  async createInspection(req: Request, res: Response) {
    try {
      const { order_id, inspected_qty, passed_qty, failed_qty } = req.body;

      const order = await orderRepo.findOne({ where: { id: order_id } });
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });

      // Определяем результат
      let result: InspectionResult;
      if (Number(failed_qty) === 0) {
        result = InspectionResult.PASS;
      } else if (Number(failed_qty) >= Number(inspected_qty) * 0.1) {
        result = InspectionResult.FAIL;
      } else {
        result = InspectionResult.CONDITIONAL;
      }

      const inspection = inspectionRepo.create({
        ...req.body,
        result,
      } as Partial<QcInspection>);

      const saved = await inspectionRepo.save(inspection as QcInspection);

      // Обновляем счётчики в заказе
      await orderRepo.update(order_id, {
        qc_passed: Number(order.qc_passed) + Number(passed_qty),
        qc_failed: Number(order.qc_failed) + Number(failed_qty),
      });

      const full = await inspectionRepo.findOne({
        where: { id: saved.id },
        relations: ['order', 'checklist', 'inspector', 'order.kit'],
      });
      res.status(201).json(full);
    } catch (error) {
      console.error('Ошибка при создании проверки:', error);
      res.status(500).json({ error: 'Ошибка при создании проверки' });
    }
  },

  async getInspectionById(req: Request, res: Response) {
    try {
      const inspection = await inspectionRepo.findOne({
        where: { id: req.params.id },
        relations: ['order', 'checklist', 'inspector', 'order.kit'],
      });
      if (!inspection) return res.status(404).json({ error: 'Проверка не найдена' });
      res.json(inspection);
    } catch (error) {
      console.error('Ошибка при получении проверки:', error);
      res.status(500).json({ error: 'Ошибка при получении проверки' });
    }
  },

  /** GET /api/qc/stats — статистика брака */
  async stats(req: Request, res: Response) {
    try {
      const stats = await inspectionRepo.createQueryBuilder('i')
        .select('i.result', 'result')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(i.inspected_qty)', 'total_inspected')
        .addSelect('SUM(i.passed_qty)', 'total_passed')
        .addSelect('SUM(i.failed_qty)', 'total_failed')
        .groupBy('i.result')
        .getRawMany();

      res.json(stats);
    } catch (error) {
      console.error('Ошибка при получении статистики QC:', error);
      res.status(500).json({ error: 'Ошибка при получении статистики QC' });
    }
  },
};
