import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Supply } from '../entities/Supply';
import { SupplyItem } from '../entities/SupplyItem';
import { Transaction, TransactionType, TransactionSource } from '../entities/Transaction';
import { Component } from '../entities/Component';
import { ComponentPart } from '../entities/ComponentPart';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

const supplyRepository = AppDataSource.getRepository(Supply);
const supplyItemRepository = AppDataSource.getRepository(SupplyItem);

export const supplyController = {
  // Получить все поставки
  async getAll(req: Request, res: Response) {
    try {
      const { startDate, endDate, supplierId, componentId } = req.query;

      let where: any = {};

      if (supplierId) where.supplier_id = supplierId;

      if (startDate && endDate) {
        where.supply_date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.supply_date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.supply_date = LessThanOrEqual(new Date(endDate as string));
      }

      const supplies = await supplyRepository.find({
        where,
        relations: ['supplier', 'carrier', 'items', 'items.component'],
        order: { supply_date: 'DESC', created_at: 'DESC' },
      });

      // Если фильтр по componentId — фильтруем на уровне JS
      if (componentId) {
        const filtered = supplies.filter((s) =>
          s.items.some((item) => item.component_id === componentId)
        );
        return res.json(filtered);
      }

      res.json(supplies);
    } catch (error) {
      console.error('Ошибка при получении поставок:', error);
      res.status(500).json({ error: 'Ошибка при получении поставок' });
    }
  },

  // Получить поставку по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supply = await supplyRepository.findOne({
        where: { id },
        relations: ['supplier', 'carrier', 'items', 'items.component'],
      });

      if (!supply) {
        return res.status(404).json({ error: 'Поставка не найдена' });
      }

      res.json(supply);
    } catch (error) {
      console.error('Ошибка при получении поставки:', error);
      res.status(500).json({ error: 'Ошибка при получении поставки' });
    }
  },

  // Создать поставку с авто-транзакциями
  async create(req: Request, res: Response) {
    try {
      const { supplier_id, carrier_id, delivery_cost, supply_date, notes, items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Поставка должна содержать хотя бы одну позицию' });
      }

      const result = await AppDataSource.manager.transaction(async (em) => {
        // 1. Создаём поставку
        const supply = em.create(Supply, {
          supplier_id: supplier_id || null,
          carrier_id: carrier_id || null,
          delivery_cost: delivery_cost || 0,
          supply_date: supply_date || null,
          notes: notes || null,
        });
        const savedSupply = await em.save(Supply, supply);

        // 2. Рассчитываем стоимость доставки на единицу
        const totalQuantity = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
        const deliveryCostNum = Number(delivery_cost) || 0;

        // 3. Создаём позиции
        let materialTotal = 0;
        const savedItems: SupplyItem[] = [];

        for (const itemData of items) {
          const quantity = Number(itemData.quantity) || 0;
          const enteredPrice = Number(itemData.entered_price) || 0;
          const priceMode = itemData.price_mode || 'total';

          let unitCost: number;
          let totalCost: number;

          if (priceMode === 'unit') {
            unitCost = enteredPrice;
            totalCost = enteredPrice * quantity;
          } else {
            totalCost = enteredPrice;
            unitCost = quantity > 0 ? enteredPrice / quantity : 0;
          }

          // Доставка пропорционально количеству
          const unitDeliveryCost = totalQuantity > 0
            ? (deliveryCostNum * quantity) / totalQuantity / quantity
            : 0;

          const supplyItem = em.create(SupplyItem, {
            supply_id: savedSupply.id,
            component_id: itemData.component_id,
            quantity,
            price_mode: priceMode,
            entered_price: enteredPrice,
            unit_cost: Math.round(unitCost * 100) / 100,
            total_cost: Math.round(totalCost * 100) / 100,
            unit_delivery_cost: Math.round(unitDeliveryCost * 100) / 100,
          });

          const saved = await em.save(SupplyItem, supplyItem);
          savedItems.push(saved);
          materialTotal += totalCost;
        }

        // 4. Авто-транзакции
        // Загружаем названия компонентов для описания
        const componentIds = items.map((it: any) => it.component_id);
        const components = await em.findByIds(Component, componentIds);
        const componentNames = components.map((c) => c.name).join(', ');

        // Транзакция на материалы
        if (materialTotal > 0 && supply_date) {
          const materialTx = em.create(Transaction, {
            type: TransactionType.EXPENSE,
            amount: Math.round(materialTotal * 100) / 100,
            description: `Поставка: ${componentNames}`,
            date: supply_date,
            counterparty_id: supplier_id || null,
            source: TransactionSource.SUPPLY,
            source_id: savedSupply.id,
            notes: notes || null,
          });
          await em.save(Transaction, materialTx);
        }

        // Транзакция на доставку
        if (deliveryCostNum > 0 && supply_date) {
          const deliveryTx = em.create(Transaction, {
            type: TransactionType.EXPENSE,
            amount: deliveryCostNum,
            description: `Доставка: ${componentNames}`,
            date: supply_date,
            counterparty_id: carrier_id || null,
            source: TransactionSource.SUPPLY,
            source_id: savedSupply.id,
          });
          await em.save(Transaction, deliveryTx);
        }

        // 5. Обновить cost_materials / cost_logistics на компонентах
        for (const savedItem of savedItems) {
          const costMaterials = Number(savedItem.unit_cost) || 0;
          const costLogistics = Number(savedItem.unit_delivery_cost) || 0;
          const comp = components.find(c => c.id === savedItem.component_id);
          const costLabor = Number(comp?.cost_labor) || 0;
          const unitPrice = costMaterials + costLogistics + costLabor;

          await em.update(Component, savedItem.component_id, {
            cost_materials: Math.round(costMaterials * 100) / 100,
            cost_logistics: Math.round(costLogistics * 100) / 100,
            unit_price: Math.round(unitPrice * 100) / 100,
          });
        }

        // 6. Пересчитать составные компоненты, содержащие обновлённые детали
        const updatedComponentIds = savedItems.map(si => si.component_id);
        const affectedParts = await em.find(ComponentPart, {
          where: updatedComponentIds.map(cid => ({ part_id: cid })),
        });
        const compositeIds = [...new Set(affectedParts.map(p => p.composite_id))];

        for (const compositeId of compositeIds) {
          const allParts = await em.find(ComponentPart, {
            where: { composite_id: compositeId },
            relations: ['part'],
          });
          const totalMaterials = allParts.reduce((s, p) => s + Number(p.part.cost_materials) * Number(p.quantity), 0);
          const totalLogistics = allParts.reduce((s, p) => s + Number(p.part.cost_logistics) * Number(p.quantity), 0);
          const totalLabor = allParts.reduce((s, p) => s + Number(p.part.cost_labor) * Number(p.quantity), 0);
          const totalPrice = totalMaterials + totalLogistics + totalLabor;
          const totalWeight = allParts.reduce((s, p) => s + (Number(p.part.weight_kg) || 0) * Number(p.quantity), 0);

          await em.update(Component, compositeId, {
            cost_materials: Math.round(totalMaterials * 100) / 100,
            cost_logistics: Math.round(totalLogistics * 100) / 100,
            cost_labor: Math.round(totalLabor * 100) / 100,
            unit_price: Math.round(totalPrice * 100) / 100,
            price_per_kit: Math.round(totalPrice * 100) / 100,
            ...(totalWeight > 0 ? { weight_kg: Math.round(totalWeight * 1000) / 1000 } : {}),
          });
        }

        return savedSupply;
      });

      // Возвращаем полную поставку с relations
      const fullSupply = await supplyRepository.findOne({
        where: { id: result.id },
        relations: ['supplier', 'carrier', 'items', 'items.component'],
      });

      res.status(201).json(fullSupply);
    } catch (error) {
      console.error('Ошибка при создании поставки:', error);
      res.status(500).json({ error: 'Ошибка при создании поставки' });
    }
  },

  // Обновить поставку (без пересоздания транзакций)
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supply = await supplyRepository.findOne({ where: { id } });

      if (!supply) {
        return res.status(404).json({ error: 'Поставка не найдена' });
      }

      const { items, ...supplyData } = req.body;

      // Обновляем основные поля поставки
      await supplyRepository.update(id, {
        supplier_id: supplyData.supplier_id ?? supply.supplier_id,
        carrier_id: supplyData.carrier_id ?? supply.carrier_id,
        delivery_cost: supplyData.delivery_cost ?? supply.delivery_cost,
        supply_date: supplyData.supply_date ?? supply.supply_date,
        notes: supplyData.notes !== undefined ? supplyData.notes : supply.notes,
      });

      // Если переданы items — пересоздаём
      if (items && Array.isArray(items)) {
        await AppDataSource.manager.transaction(async (em) => {
          // Удаляем старые
          await em.delete(SupplyItem, { supply_id: id });

          const deliveryCostNum = Number(supplyData.delivery_cost ?? supply.delivery_cost) || 0;
          const totalQuantity = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);

          // Загружаем компоненты для сохранения cost_labor
          const componentIds = items.map((it: any) => it.component_id);
          const components = await em.findByIds(Component, componentIds);

          const savedItems: SupplyItem[] = [];

          // Создаём новые
          for (const itemData of items) {
            const quantity = Number(itemData.quantity) || 0;
            const enteredPrice = Number(itemData.entered_price) || 0;
            const priceMode = itemData.price_mode || 'total';

            let unitCost: number;
            let totalCost: number;

            if (priceMode === 'unit') {
              unitCost = enteredPrice;
              totalCost = enteredPrice * quantity;
            } else {
              totalCost = enteredPrice;
              unitCost = quantity > 0 ? enteredPrice / quantity : 0;
            }

            const unitDeliveryCost = totalQuantity > 0
              ? (deliveryCostNum * quantity) / totalQuantity / quantity
              : 0;

            const supplyItem = em.create(SupplyItem, {
              supply_id: id,
              component_id: itemData.component_id,
              quantity,
              price_mode: priceMode,
              entered_price: enteredPrice,
              unit_cost: Math.round(unitCost * 100) / 100,
              total_cost: Math.round(totalCost * 100) / 100,
              unit_delivery_cost: Math.round(unitDeliveryCost * 100) / 100,
            });

            const saved = await em.save(SupplyItem, supplyItem);
            savedItems.push(saved);
          }

          // Обновить cost_materials / cost_logistics на компонентах
          for (const savedItem of savedItems) {
            const costMaterials = Number(savedItem.unit_cost) || 0;
            const costLogistics = Number(savedItem.unit_delivery_cost) || 0;
            const comp = components.find(c => c.id === savedItem.component_id);
            const costLabor = Number(comp?.cost_labor) || 0;
            const unitPrice = costMaterials + costLogistics + costLabor;

            await em.update(Component, savedItem.component_id, {
              cost_materials: Math.round(costMaterials * 100) / 100,
              cost_logistics: Math.round(costLogistics * 100) / 100,
              unit_price: Math.round(unitPrice * 100) / 100,
            });
          }

          // Пересчитать составные компоненты
          const updatedIds = savedItems.map(si => si.component_id);
          const affectedParts = await em.find(ComponentPart, {
            where: updatedIds.map(cid => ({ part_id: cid })),
          });
          const compositeIds = [...new Set(affectedParts.map(p => p.composite_id))];
          for (const compositeId of compositeIds) {
            const allParts = await em.find(ComponentPart, {
              where: { composite_id: compositeId },
              relations: ['part'],
            });
            const tm = allParts.reduce((s, p) => s + Number(p.part.cost_materials) * Number(p.quantity), 0);
            const tl = allParts.reduce((s, p) => s + Number(p.part.cost_logistics) * Number(p.quantity), 0);
            const tb = allParts.reduce((s, p) => s + Number(p.part.cost_labor) * Number(p.quantity), 0);
            const tp = tm + tl + tb;
            const tw = allParts.reduce((s, p) => s + (Number(p.part.weight_kg) || 0) * Number(p.quantity), 0);
            await em.update(Component, compositeId, {
              cost_materials: Math.round(tm * 100) / 100,
              cost_logistics: Math.round(tl * 100) / 100,
              cost_labor: Math.round(tb * 100) / 100,
              unit_price: Math.round(tp * 100) / 100,
              price_per_kit: Math.round(tp * 100) / 100,
              ...(tw > 0 ? { weight_kg: Math.round(tw * 1000) / 1000 } : {}),
            });
          }
        });
      }

      const updatedSupply = await supplyRepository.findOne({
        where: { id },
        relations: ['supplier', 'carrier', 'items', 'items.component'],
      });

      res.json(updatedSupply);
    } catch (error) {
      console.error('Ошибка при обновлении поставки:', error);
      res.status(500).json({ error: 'Ошибка при обновлении поставки' });
    }
  },

  // Удалить поставку и связанные авто-транзакции
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const supply = await supplyRepository.findOne({ where: { id } });
      if (!supply) {
        return res.status(404).json({ error: 'Поставка не найдена' });
      }

      await AppDataSource.manager.transaction(async (em) => {
        // Удаляем авто-транзакции, привязанные к поставке
        await em
          .createQueryBuilder()
          .delete()
          .from(Transaction)
          .where('source = :source AND source_id = :sourceId', {
            source: TransactionSource.SUPPLY,
            sourceId: id,
          })
          .execute();

        // supply_items удалятся каскадно
        await em.delete(Supply, id);
      });

      res.json({ message: 'Поставка удалена' });
    } catch (error) {
      console.error('Ошибка при удалении поставки:', error);
      res.status(500).json({ error: 'Ошибка при удалении поставки' });
    }
  },
};
