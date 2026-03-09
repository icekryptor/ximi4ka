import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ProductionOrder, OrderStatus } from '../entities/ProductionOrder';
import { Kit } from '../entities/Kit';

const repo = AppDataSource.getRepository(ProductionOrder);
const kitRepo = AppDataSource.getRepository(Kit);

export const productionOrderController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status, kit_id, channel_id } = req.query;
      const qb = repo.createQueryBuilder('o')
        .leftJoinAndSelect('o.kit', 'kit')
        .leftJoinAndSelect('o.channel', 'channel')
        .orderBy('o.created_at', 'DESC');

      if (status) qb.andWhere('o.status = :status', { status });
      if (kit_id) qb.andWhere('o.kit_id = :kit_id', { kit_id });
      if (channel_id) qb.andWhere('o.channel_id = :channel_id', { channel_id });

      const orders = await qb.getMany();
      res.json(orders);
    } catch (error) {
      console.error('Ошибка при получении заказов:', error);
      res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const order = await repo.findOne({
        where: { id: req.params.id },
        relations: ['kit', 'channel'],
      });
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });
      res.json(order);
    } catch (error) {
      console.error('Ошибка при получении заказа:', error);
      res.status(500).json({ error: 'Ошибка при получении заказа' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { kit_id, quantity } = req.body;

      const kit = await kitRepo.findOne({ where: { id: kit_id } });
      if (!kit) return res.status(404).json({ error: 'Набор не найден' });

      const plannedCost = Number(kit.total_cost) * Number(quantity);

      // Генерируем номер заказа: PO-YYYYMMDD-NNN
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await repo.count();
      const orderNumber = `PO-${today}-${String(count + 1).padStart(3, '0')}`;

      const order = repo.create({
        ...req.body,
        order_number: orderNumber,
        planned_cost: Math.round(plannedCost * 100) / 100,
        status: OrderStatus.CREATED,
      } as Partial<ProductionOrder>);

      const saved = await repo.save(order as ProductionOrder);
      const result = await repo.findOne({
        where: { id: saved.id },
        relations: ['kit', 'channel'],
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка при создании заказа:', error);
      res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await repo.findOne({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Заказ не найден' });

      await repo.update(id, req.body);
      const updated = await repo.findOne({
        where: { id },
        relations: ['kit', 'channel'],
      });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении заказа:', error);
      res.status(500).json({ error: 'Ошибка при обновлении заказа' });
    }
  },

  /** PATCH /api/orders/:id/status — переход по статусам */
  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const order = await repo.findOne({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Заказ не найден' });

      if (!Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
      }

      const updates: Partial<ProductionOrder> = { status };
      if (status === OrderStatus.SHIPPED || status === OrderStatus.AT_MARKETPLACE) {
        updates.completed_date = new Date().toISOString().slice(0, 10);
      }

      await repo.update(id, updates);
      const updated = await repo.findOne({ where: { id }, relations: ['kit', 'channel'] });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error);
      res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Заказ не найден' });
      res.json({ message: 'Заказ удалён' });
    } catch (error) {
      console.error('Ошибка при удалении заказа:', error);
      res.status(500).json({ error: 'Ошибка при удалении заказа' });
    }
  },

  /** GET /api/orders/stats — сводная статистика */
  async stats(req: Request, res: Response) {
    try {
      const stats = await repo.createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(o.quantity)', 'total_qty')
        .groupBy('o.status')
        .getRawMany();

      res.json(stats);
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      res.status(500).json({ error: 'Ошибка при получении статистики' });
    }
  },
};
