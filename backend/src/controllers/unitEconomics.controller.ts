import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { UnitEconomics } from '../entities/UnitEconomics';
import { Kit } from '../entities/Kit';
import { SalesChannel } from '../entities/SalesChannel';

const repo = AppDataSource.getRepository(UnitEconomics);
const kitRepo = AppDataSource.getRepository(Kit);
const channelRepo = AppDataSource.getRepository(SalesChannel);

export const unitEconomicsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { kit_id, channel_id, period } = req.query;
      const qb = repo.createQueryBuilder('ue')
        .leftJoinAndSelect('ue.kit', 'kit')
        .leftJoinAndSelect('ue.channel', 'channel')
        .orderBy('ue.created_at', 'DESC');

      if (kit_id) qb.andWhere('ue.kit_id = :kit_id', { kit_id });
      if (channel_id) qb.andWhere('ue.channel_id = :channel_id', { channel_id });
      if (period) qb.andWhere('ue.period = :period', { period });

      const items = await qb.getMany();
      res.json(items);
    } catch (error) {
      console.error('Ошибка при получении unit-экономики:', error);
      res.status(500).json({ error: 'Ошибка при получении unit-экономики' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const item = await repo.findOne({
        where: { id: req.params.id },
        relations: ['kit', 'channel'],
      });
      if (!item) return res.status(404).json({ error: 'Расчёт не найден' });
      res.json(item);
    } catch (error) {
      console.error('Ошибка при получении расчёта:', error);
      res.status(500).json({ error: 'Ошибка при получении расчёта' });
    }
  },

  /**
   * POST /api/economics/unit/calculate
   * Рассчитать unit-экономику для SKU × канал
   * Body: { kit_id, channel_id, selling_price, period? }
   */
  async calculate(req: Request, res: Response) {
    try {
      const { kit_id, channel_id, selling_price, period } = req.body;

      const kit = await kitRepo.findOne({ where: { id: kit_id } });
      if (!kit) return res.status(404).json({ error: 'Набор не найден' });

      const channel = await channelRepo.findOne({ where: { id: channel_id } });
      if (!channel) return res.status(404).json({ error: 'Канал продаж не найден' });

      const price = Number(selling_price);
      const costPrice = Number(kit.total_cost);
      const commissionPct = Number(channel.commission_pct);
      const logisticsCost = Number(channel.logistics_cost);
      const storageCost = Number(channel.storage_cost);
      const adSpendPct = Number(channel.ad_spend_pct);

      const commissionAmount = price * commissionPct / 100;
      const adSpendAmount = price * adSpendPct / 100;

      const unitMargin = price - costPrice - commissionAmount - logisticsCost - storageCost - adSpendAmount;
      const marginPct = price > 0 ? (unitMargin / price) * 100 : 0;

      const calc = repo.create({
        kit_id,
        channel_id,
        selling_price: price,
        cost_price: costPrice,
        logistics_cost: logisticsCost,
        storage_cost: storageCost,
        ad_spend_pct: adSpendPct,
        commission_pct: commissionPct,
        commission_amount: Math.round(commissionAmount * 100) / 100,
        ad_spend_amount: Math.round(adSpendAmount * 100) / 100,
        unit_margin: Math.round(unitMargin * 100) / 100,
        margin_pct: Math.round(marginPct * 100) / 100,
        period: period || null,
      });

      const saved = await repo.save(calc);
      const result = await repo.findOne({
        where: { id: saved.id },
        relations: ['kit', 'channel'],
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка при расчёте unit-экономики:', error);
      res.status(500).json({ error: 'Ошибка при расчёте unit-экономики' });
    }
  },

  /**
   * POST /api/economics/margin/matrix
   * Рассчитать маржинальность для всех SKU × все каналы
   */
  async marginMatrix(req: Request, res: Response) {
    try {
      const { prices } = req.body;
      // prices: [{ kit_id, channel_id, selling_price }]

      const kits = await kitRepo.find({ where: { is_active: true } });
      const channels = await channelRepo.find({ where: { is_active: true } });

      const matrix: any[] = [];

      for (const kit of kits) {
        const row: any = {
          kit_id: kit.id,
          kit_name: kit.name,
          sku: kit.sku,
          cost_price: Number(kit.total_cost),
          channels: {},
        };

        for (const ch of channels) {
          const priceEntry = prices?.find((p: any) => p.kit_id === kit.id && p.channel_id === ch.id);
          const sellingPrice = priceEntry ? Number(priceEntry.selling_price) : (Number(kit.retail_price) || 0);

          const commission = sellingPrice * Number(ch.commission_pct) / 100;
          const adSpend = sellingPrice * Number(ch.ad_spend_pct) / 100;
          const logistics = Number(ch.logistics_cost);
          const storage = Number(ch.storage_cost);
          const costPrice = Number(kit.total_cost);

          const margin = sellingPrice - costPrice - commission - logistics - storage - adSpend;
          const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

          row.channels[ch.marketplace] = {
            channel_id: ch.id,
            channel_name: ch.name,
            selling_price: sellingPrice,
            commission: Math.round(commission * 100) / 100,
            logistics,
            storage,
            ad_spend: Math.round(adSpend * 100) / 100,
            margin: Math.round(margin * 100) / 100,
            margin_pct: Math.round(marginPct * 100) / 100,
          };
        }

        matrix.push(row);
      }

      res.json({ kits: matrix, channels: channels.map(c => ({ id: c.id, name: c.name, marketplace: c.marketplace })) });
    } catch (error) {
      console.error('Ошибка при расчёте матрицы маржинальности:', error);
      res.status(500).json({ error: 'Ошибка при расчёте матрицы маржинальности' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Расчёт не найден' });
      res.json({ message: 'Расчёт удалён' });
    } catch (error) {
      console.error('Ошибка при удалении расчёта:', error);
      res.status(500).json({ error: 'Ошибка при удалении расчёта' });
    }
  },
};
