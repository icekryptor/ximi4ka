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

      // Get existing sales for dedup — only load matching marketplace + date range
      const importDates = new Set<string>();
      sheet.eachRow((row, idx) => {
        if (idx === 1) return;
        const dateRaw = String(row.getCell(1).value || '').trim();
        if (dateRaw) {
          if (dateRaw.includes('.')) {
            const parts = dateRaw.split('.');
            importDates.add(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else {
            importDates.add(dateRaw);
          }
        }
      });

      let existingKeys = new Set<string>();
      const dateArray = Array.from(importDates);
      if (dateArray.length > 0) {
        const existingSales = await saleRepository
          .createQueryBuilder('s')
          .select(['s.date', 's.sku', 's.marketplace'])
          .where('s.marketplace = :marketplace AND s.date IN (:...dates)', {
            marketplace,
            dates: dateArray,
          })
          .getMany();
        existingKeys = new Set(
          existingSales.map((s) => `${String(s.date).split('T')[0]}|${s.sku}|${s.marketplace}`)
        );
      }

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

      const entities = rows.map((row: any) => ({
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
      }));

      // Bulk insert in batches of 500
      let imported = 0;
      await AppDataSource.manager.transaction(async (em) => {
        for (let i = 0; i < entities.length; i += 500) {
          const batch = entities.slice(i, i + 500);
          await em.createQueryBuilder()
            .insert()
            .into(MarketplaceSale)
            .values(batch)
            .execute();
          imported += batch.length;
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

      // Build WHERE clause for SQL
      const params: any = { marketplace };
      let dateCondition = '';
      if (startDate && endDate) {
        dateCondition = ' AND s.date BETWEEN :startDate AND :endDate';
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (startDate) {
        dateCondition = ' AND s.date >= :startDate';
        params.startDate = startDate;
      } else if (endDate) {
        dateCondition = ' AND s.date <= :endDate';
        params.endDate = endDate;
      }

      const baseWhere = `s.marketplace = :marketplace${dateCondition}`;

      // Run 3 SQL aggregation queries in parallel instead of loading all rows
      const [bySkuRows, byDateRows, totalsRow] = await Promise.all([
        // Aggregate by SKU
        saleRepository.createQueryBuilder('s')
          .select('s.sku', 'sku')
          .addSelect('MAX(s.product_name)', 'product_name')
          .addSelect('SUM(s.orders_count)', 'orders')
          .addSelect('SUM(s.buyouts_count)', 'buyouts')
          .addSelect('SUM(s.revenue)', 'revenue')
          .addSelect('SUM(s.commission)', 'commission')
          .addSelect('SUM(s.logistics_cost)', 'logistics')
          .addSelect('SUM(s.storage_cost)', 'storage')
          .addSelect('SUM(s.other_costs)', 'other')
          .addSelect('SUM(s.acquiring_cost)', 'acquiring')
          .addSelect('SUM(s.payout)', 'payout')
          .addSelect('COUNT(*)', 'days')
          .where(baseWhere, params)
          .groupBy('s.sku')
          .orderBy('SUM(s.revenue)', 'DESC')
          .getRawMany(),

        // Aggregate by date (for chart)
        saleRepository.createQueryBuilder('s')
          .select('s.date', 'date')
          .addSelect('SUM(s.orders_count)', 'orders')
          .addSelect('SUM(s.buyouts_count)', 'buyouts')
          .addSelect('SUM(s.revenue)', 'revenue')
          .addSelect('SUM(s.payout)', 'payout')
          .where(baseWhere, params)
          .groupBy('s.date')
          .orderBy('s.date', 'ASC')
          .getRawMany(),

        // Totals + count
        saleRepository.createQueryBuilder('s')
          .select('SUM(s.orders_count)', 'orders')
          .addSelect('SUM(s.buyouts_count)', 'buyouts')
          .addSelect('SUM(s.revenue)', 'revenue')
          .addSelect('SUM(s.commission)', 'commission')
          .addSelect('SUM(s.logistics_cost)', 'logistics')
          .addSelect('SUM(s.storage_cost)', 'storage')
          .addSelect('SUM(s.other_costs)', 'other')
          .addSelect('SUM(s.acquiring_cost)', 'acquiring')
          .addSelect('SUM(s.payout)', 'payout')
          .addSelect('COUNT(*)', 'count')
          .where(baseWhere, params)
          .getRawOne(),
      ]);

      const totals = {
        orders: Number(totalsRow?.orders) || 0,
        buyouts: Number(totalsRow?.buyouts) || 0,
        revenue: Number(totalsRow?.revenue) || 0,
        commission: Number(totalsRow?.commission) || 0,
        logistics: Number(totalsRow?.logistics) || 0,
        storage: Number(totalsRow?.storage) || 0,
        other: Number(totalsRow?.other) || 0,
        acquiring: Number(totalsRow?.acquiring) || 0,
        payout: Number(totalsRow?.payout) || 0,
      };

      const buyoutRate = totals.orders > 0 ? Math.round((totals.buyouts / totals.orders) * 1000) / 10 : 0;

      // Map raw rows to typed objects
      const bySku = bySkuRows.map((r: any) => ({
        sku: r.sku,
        product_name: r.product_name || r.sku,
        orders: Number(r.orders),
        buyouts: Number(r.buyouts),
        revenue: Number(r.revenue),
        commission: Number(r.commission),
        logistics: Number(r.logistics),
        storage: Number(r.storage),
        other: Number(r.other),
        acquiring: Number(r.acquiring),
        payout: Number(r.payout),
        days: Number(r.days),
      }));

      const byDate = byDateRows.map((r: any) => ({
        date: String(r.date).split('T')[0],
        orders: Number(r.orders),
        buyouts: Number(r.buyouts),
        revenue: Number(r.revenue),
        payout: Number(r.payout),
      }));

      res.json({
        marketplace,
        totals: { ...totals, buyoutRate },
        bySku,
        byDate,
        salesCount: Number(totalsRow?.count) || 0,
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
