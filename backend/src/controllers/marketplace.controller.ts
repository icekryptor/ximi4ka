import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { MarketplaceSale, Marketplace } from '../entities/MarketplaceSale';
import { SkuMapping } from '../entities/SkuMapping';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import ExcelJS from 'exceljs';

const saleRepository = AppDataSource.getRepository(MarketplaceSale);
const skuRepository = AppDataSource.getRepository(SkuMapping);

export const marketplaceController = {
  // ===== SALES CRUD =====
  async getSales(req: Request, res: Response) {
    try {
      const { marketplace, startDate, endDate, sku } = req.query;

      let where: any = {};
      if (marketplace) where.marketplace = marketplace;
      if (sku) where.sku = sku;
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate as string));
      }

      const sales = await saleRepository.find({
        where,
        order: { date: 'DESC', sku: 'ASC' },
      });

      res.json(sales);
    } catch (error) {
      console.error('Ошибка получения продаж:', error);
      res.status(500).json({ error: 'Ошибка при получении продаж' });
    }
  },

  async getSaleById(req: Request, res: Response) {
    try {
      const sale = await saleRepository.findOne({ where: { id: req.params.id } });
      if (!sale) return res.status(404).json({ error: 'Запись не найдена' });
      res.json(sale);
    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({ error: 'Ошибка при получении записи' });
    }
  },

  async createSale(req: Request, res: Response) {
    try {
      const sale = saleRepository.create(req.body as Partial<MarketplaceSale>);
      // Auto-calculate payout if not provided
      if (sale.marketplace === Marketplace.WILDBERRIES) {
        sale.payout = Number(sale.revenue) - Number(sale.commission) - Number(sale.logistics_cost) - Number(sale.storage_cost) - Number(sale.other_costs);
      } else {
        sale.payout = Number(sale.revenue) - Number(sale.logistics_cost) - Number(sale.acquiring_cost);
      }
      const result = await saleRepository.save(sale);
      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка создания:', error);
      res.status(500).json({ error: 'Ошибка при создании записи' });
    }
  },

  async updateSale(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await saleRepository.findOne({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Запись не найдена' });

      await saleRepository.update(id, req.body);
      const updated = await saleRepository.findOne({ where: { id } });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка обновления:', error);
      res.status(500).json({ error: 'Ошибка при обновлении записи' });
    }
  },

  async deleteSale(req: Request, res: Response) {
    try {
      const result = await saleRepository.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Запись не найдена' });
      res.json({ message: 'Удалено' });
    } catch (error) {
      console.error('Ошибка удаления:', error);
      res.status(500).json({ error: 'Ошибка при удалении записи' });
    }
  },

  // ===== IMPORT =====
  async importSales(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

      const marketplace = (req.body.marketplace || 'wildberries') as Marketplace;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer as any);
      const sheet = workbook.worksheets[0];

      if (!sheet) return res.status(400).json({ error: 'Пустой файл' });

      const parsed: any[] = [];
      const errors: string[] = [];

      // Get existing sales for dedup
      const existingSales = await saleRepository.find({ select: ['date', 'sku', 'marketplace'] });
      const existingKeys = new Set(
        existingSales.map((s) => `${String(s.date).split('T')[0]}|${s.sku}|${s.marketplace}`)
      );

      sheet.eachRow((row, idx) => {
        if (idx === 1) return; // skip header
        try {
          const dateRaw = String(row.getCell(1).value || '').trim();
          const sku = String(row.getCell(2).value || '').trim();
          const productName = String(row.getCell(3).value || '').trim();
          const ordersCount = Number(row.getCell(4).value) || 0;
          const buyoutsCount = Number(row.getCell(5).value) || 0;
          const revenue = Number(row.getCell(6).value) || 0;
          const commission = Number(row.getCell(7).value) || 0;
          const logisticsCost = Number(row.getCell(8).value) || 0;
          const storageCost = Number(row.getCell(9).value) || 0;
          const otherCosts = Number(row.getCell(10).value) || 0;
          const acquiringCost = Number(row.getCell(11).value) || 0;

          if (!dateRaw || !sku) {
            errors.push(`Строка ${idx}: пустая дата или артикул`);
            return;
          }

          // Parse date
          let date: string;
          if (dateRaw.includes('.')) {
            const parts = dateRaw.split('.');
            date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            date = dateRaw;
          }

          const isDuplicate = existingKeys.has(`${date}|${sku}|${marketplace}`);

          let payout: number;
          if (marketplace === Marketplace.WILDBERRIES) {
            payout = revenue - commission - logisticsCost - storageCost - otherCosts;
          } else {
            payout = revenue - logisticsCost - acquiringCost;
          }

          parsed.push({
            row: idx,
            marketplace,
            date,
            sku,
            product_name: productName,
            orders_count: ordersCount,
            buyouts_count: buyoutsCount,
            revenue,
            commission,
            logistics_cost: logisticsCost,
            storage_cost: storageCost,
            other_costs: otherCosts,
            acquiring_cost: acquiringCost,
            payout,
            is_duplicate: isDuplicate,
          });
        } catch (e) {
          errors.push(`Строка ${idx}: ошибка парсинга`);
        }
      });

      const duplicates = parsed.filter((r) => r.is_duplicate).length;
      res.json({
        parsed,
        duplicates,
        newRows: parsed.length - duplicates,
        errors,
        total: parsed.length,
      });
    } catch (error) {
      console.error('Ошибка импорта продаж:', error);
      res.status(500).json({ error: 'Ошибка при импорте' });
    }
  },

  async confirmImportSales(req: Request, res: Response) {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Нет данных для импорта' });
      }

      let imported = 0;
      await AppDataSource.manager.transaction(async (em) => {
        for (const row of rows) {
          const sale = em.create(MarketplaceSale, {
            marketplace: row.marketplace,
            date: row.date,
            sku: row.sku,
            product_name: row.product_name,
            orders_count: row.orders_count,
            buyouts_count: row.buyouts_count,
            revenue: row.revenue,
            commission: row.commission,
            logistics_cost: row.logistics_cost,
            storage_cost: row.storage_cost,
            other_costs: row.other_costs,
            acquiring_cost: row.acquiring_cost,
            payout: row.payout,
          });
          await em.save(MarketplaceSale, sale);
          imported++;
        }
      });

      res.json({ imported });
    } catch (error) {
      console.error('Ошибка подтверждения импорта:', error);
      res.status(500).json({ error: 'Ошибка при импорте' });
    }
  },

  // ===== ANALYTICS =====
  async getAnalytics(req: Request, res: Response) {
    try {
      const marketplace = req.params.marketplace as string;
      const { startDate, endDate } = req.query;

      let where: any = { marketplace };
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate as string));
      }

      const sales = await saleRepository.find({
        where,
        order: { date: 'ASC', sku: 'ASC' },
      });

      // Aggregate by SKU
      const bySku = new Map<string, {
        sku: string;
        product_name: string;
        orders: number;
        buyouts: number;
        revenue: number;
        commission: number;
        logistics: number;
        storage: number;
        other: number;
        acquiring: number;
        payout: number;
        days: number;
      }>();

      for (const s of sales) {
        const existing = bySku.get(s.sku) || {
          sku: s.sku,
          product_name: s.product_name || s.sku,
          orders: 0, buyouts: 0, revenue: 0, commission: 0,
          logistics: 0, storage: 0, other: 0, acquiring: 0, payout: 0, days: 0,
        };
        existing.orders += Number(s.orders_count);
        existing.buyouts += Number(s.buyouts_count);
        existing.revenue += Number(s.revenue);
        existing.commission += Number(s.commission);
        existing.logistics += Number(s.logistics_cost);
        existing.storage += Number(s.storage_cost);
        existing.other += Number(s.other_costs);
        existing.acquiring += Number(s.acquiring_cost);
        existing.payout += Number(s.payout);
        existing.days += 1;
        bySku.set(s.sku, existing);
      }

      // Aggregate by date (for chart)
      const byDate = new Map<string, {
        date: string;
        orders: number;
        buyouts: number;
        revenue: number;
        payout: number;
      }>();

      for (const s of sales) {
        const dateStr = String(s.date).split('T')[0];
        const existing = byDate.get(dateStr) || {
          date: dateStr, orders: 0, buyouts: 0, revenue: 0, payout: 0,
        };
        existing.orders += Number(s.orders_count);
        existing.buyouts += Number(s.buyouts_count);
        existing.revenue += Number(s.revenue);
        existing.payout += Number(s.payout);
        byDate.set(dateStr, existing);
      }

      // Totals
      const totals = {
        orders: sales.reduce((s, r) => s + Number(r.orders_count), 0),
        buyouts: sales.reduce((s, r) => s + Number(r.buyouts_count), 0),
        revenue: sales.reduce((s, r) => s + Number(r.revenue), 0),
        commission: sales.reduce((s, r) => s + Number(r.commission), 0),
        logistics: sales.reduce((s, r) => s + Number(r.logistics_cost), 0),
        storage: sales.reduce((s, r) => s + Number(r.storage_cost), 0),
        other: sales.reduce((s, r) => s + Number(r.other_costs), 0),
        acquiring: sales.reduce((s, r) => s + Number(r.acquiring_cost), 0),
        payout: sales.reduce((s, r) => s + Number(r.payout), 0),
      };

      const buyoutRate = totals.orders > 0 ? Math.round((totals.buyouts / totals.orders) * 1000) / 10 : 0;

      res.json({
        marketplace,
        totals: { ...totals, buyoutRate },
        bySku: Array.from(bySku.values()).sort((a, b) => b.revenue - a.revenue),
        byDate: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
        salesCount: sales.length,
      });
    } catch (error) {
      console.error('Ошибка аналитики:', error);
      res.status(500).json({ error: 'Ошибка при получении аналитики' });
    }
  },

  // ===== SKU MAPPINGS =====
  async getSkuMappings(req: Request, res: Response) {
    try {
      const mappings = await skuRepository.find({ relations: ['kit'], order: { marketplace_sku: 'ASC' } });
      res.json(mappings);
    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({ error: 'Ошибка при получении артикулов' });
    }
  },

  async createSkuMapping(req: Request, res: Response) {
    try {
      const mapping = skuRepository.create(req.body);
      const result = await skuRepository.save(mapping);
      res.status(201).json(result);
    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({ error: 'Ошибка при создании артикула' });
    }
  },

  async updateSkuMapping(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await skuRepository.update(id, req.body);
      const updated = await skuRepository.findOne({ where: { id }, relations: ['kit'] });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({ error: 'Ошибка при обновлении артикула' });
    }
  },

  async deleteSkuMapping(req: Request, res: Response) {
    try {
      const result = await skuRepository.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Не найдено' });
      res.json({ message: 'Удалено' });
    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({ error: 'Ошибка при удалении артикула' });
    }
  },
};
