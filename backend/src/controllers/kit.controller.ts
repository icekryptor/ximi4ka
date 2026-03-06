import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Kit } from '../entities/Kit';
import { KitComponent } from '../entities/KitComponent';
import { Component, ComponentCategory } from '../entities/Component';

const kitRepository = AppDataSource.getRepository(Kit);
const kitComponentRepository = AppDataSource.getRepository(KitComponent);
const componentRepository = AppDataSource.getRepository(Component);

export const kitController = {
  // Получить все наборы
  async getAll(req: Request, res: Response) {
    try {
      const kits = await kitRepository.find({
        relations: ['components', 'components.component'],
        order: { created_at: 'DESC' }
      });

      res.json(kits);
    } catch (error) {
      console.error('Ошибка при получении наборов:', error);
      res.status(500).json({ error: 'Ошибка при получении наборов' });
    }
  },

  // Получить набор по ID с полным расчетом
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const kit = await kitRepository.findOne({
        where: { id },
        relations: ['components', 'components.component', 'components.component.supplier']
      });

      if (!kit) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      res.json(kit);
    } catch (error) {
      console.error('Ошибка при получении набора:', error);
      res.status(500).json({ error: 'Ошибка при получении набора' });
    }
  },

  // Создать набор
  async create(req: Request, res: Response) {
    try {
      const { components, ...kitData } = req.body;

      const kit = kitRepository.create(kitData);
      const result = await kitRepository.insert(kit);
      const savedId = result.identifiers[0].id;

      if (components && Array.isArray(components)) {
        for (const comp of components) {
          const kitComponent = kitComponentRepository.create({
            kit_id: savedId,
            component_id: comp.component_id,
            quantity: comp.quantity,
            notes: comp.notes
          });
          await kitComponentRepository.insert(kitComponent);
        }
      }

      const fullKit = await kitRepository.findOne({
        where: { id: savedId },
        relations: ['components', 'components.component']
      });

      res.status(201).json(fullKit);
    } catch (error) {
      console.error('Ошибка при создании набора:', error);
      res.status(500).json({ error: 'Ошибка при создании набора' });
    }
  },

  // Обновить набор
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const kit = await kitRepository.findOne({ where: { id } });

      if (!kit) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      await kitRepository.update(id, req.body);
      const updatedKit = await kitRepository.findOne({
        where: { id },
        relations: ['components', 'components.component']
      });

      res.json(updatedKit);
    } catch (error) {
      console.error('Ошибка при обновлении набора:', error);
      res.status(500).json({ error: 'Ошибка при обновлении набора' });
    }
  },

  // Удалить набор
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await kitRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      res.json({ message: 'Набор удален' });
    } catch (error) {
      console.error('Ошибка при удалении набора:', error);
      res.status(500).json({ error: 'Ошибка при удалении набора' });
    }
  },

  // Рассчитать себестоимость набора
  async calculateCost(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const kit = await kitRepository.findOne({
        where: { id },
        relations: ['components', 'components.component']
      });

      if (!kit) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      // Используем ТОЛЬКО компоненты этого набора (с учётом количества в наборе)
      const kitComponents = kit.components || [];

      // Группируем по категориям компонентов
      const byCat = (cat: ComponentCategory) =>
        kitComponents.filter(kc => kc.component.category === cat);

      const reagentsCost = byCat(ComponentCategory.REAGENT)
        .reduce((sum, kc) => sum + Number(kc.component.unit_price) * Number(kc.quantity), 0);
      const equipmentCost = byCat(ComponentCategory.EQUIPMENT)
        .reduce((sum, kc) => sum + Number(kc.component.unit_price) * Number(kc.quantity), 0);
      const printCost = byCat(ComponentCategory.PRINT)
        .reduce((sum, kc) => sum + Number(kc.component.unit_price) * Number(kc.quantity), 0);
      const laborCost = byCat(ComponentCategory.LABOR)
        .reduce((sum, kc) => sum + Number(kc.component.unit_price) * Number(kc.quantity), 0);

      const totalCost = reagentsCost + equipmentCost + printCost + laborCost;

      // Структура стоимости (материалы / логистика / работа)
      const materialsCost = kitComponents.reduce(
        (sum, kc) => sum + Number(kc.component.cost_materials) * Number(kc.quantity), 0);
      const logisticsCost = kitComponents.reduce(
        (sum, kc) => sum + Number(kc.component.cost_logistics) * Number(kc.quantity), 0);
      const laborStructureCost = kitComponents.reduce(
        (sum, kc) => sum + Number(kc.component.cost_labor) * Number(kc.quantity), 0);

      // Обновляем набор
      await kitRepository.update(id, {
        reagents_cost: reagentsCost,
        equipment_cost: equipmentCost,
        print_cost: printCost,
        labor_cost: laborCost,
        total_cost: totalCost
      });

      res.json({
        kit_id: id,
        kit_name: kit.name,
        breakdown: {
          reagents: reagentsCost,
          equipment: equipmentCost,
          print: printCost,
          labor: laborCost
        },
        costStructure: {
          materials: materialsCost,
          logistics: logisticsCost,
          labor: laborStructureCost,
        },
        total: totalCost,
        details: {
          reagents: byCat(ComponentCategory.REAGENT).map(kc => ({
            name: kc.component.name,
            quantity: Number(kc.quantity),
            unit_price: Number(kc.component.unit_price),
            cost: Number(kc.component.unit_price) * Number(kc.quantity),
          })),
          equipment: byCat(ComponentCategory.EQUIPMENT).map(kc => ({
            name: kc.component.name,
            quantity: Number(kc.quantity),
            unit_price: Number(kc.component.unit_price),
            cost: Number(kc.component.unit_price) * Number(kc.quantity),
          })),
          print: byCat(ComponentCategory.PRINT).map(kc => ({
            name: kc.component.name,
            quantity: Number(kc.quantity),
            unit_price: Number(kc.component.unit_price),
            cost: Number(kc.component.unit_price) * Number(kc.quantity),
          })),
          labor: byCat(ComponentCategory.LABOR).map(kc => ({
            name: kc.component.name,
            quantity: Number(kc.quantity),
            unit_price: Number(kc.component.unit_price),
            cost: Number(kc.component.unit_price) * Number(kc.quantity),
          }))
        }
      });
    } catch (error) {
      console.error('Ошибка при расчете себестоимости:', error);
      res.status(500).json({ error: 'Ошибка при расчете себестоимости' });
    }
  },

  // Добавить компонент в набор
  async addComponent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { component_id, quantity = 1, notes } = req.body;

      const kit = await kitRepository.findOne({ where: { id } });
      if (!kit) return res.status(404).json({ error: 'Набор не найден' });

      const component = await componentRepository.findOne({ where: { id: component_id } });
      if (!component) return res.status(404).json({ error: 'Компонент не найден' });

      const existing = await kitComponentRepository.findOne({
        where: { kit_id: id, component_id }
      });
      if (existing) return res.status(409).json({ error: 'Компонент уже добавлен в этот набор' });

      const result = await kitComponentRepository.insert(
        kitComponentRepository.create({ kit_id: id, component_id, quantity, notes })
      );
      const kitComponent = await kitComponentRepository.findOne({
        where: { id: result.identifiers[0].id },
        relations: ['component']
      });

      res.status(201).json(kitComponent);
    } catch (error) {
      console.error('Ошибка при добавлении компонента в набор:', error);
      res.status(500).json({ error: 'Ошибка при добавлении компонента в набор' });
    }
  },

  // Обновить количество компонента в наборе
  async updateComponent(req: Request, res: Response) {
    try {
      const { id, componentId } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined || isNaN(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Укажите корректное количество (> 0)' });
      }

      const kitComponent = await kitComponentRepository.findOne({
        where: { kit_id: id, component_id: componentId }
      });

      if (!kitComponent) {
        return res.status(404).json({ error: 'Компонент не найден в наборе' });
      }

      await kitComponentRepository.update(kitComponent.id, { quantity: Number(quantity) });
      res.json({ message: 'Количество обновлено' });
    } catch (error) {
      console.error('Ошибка при обновлении компонента набора:', error);
      res.status(500).json({ error: 'Ошибка при обновлении компонента набора' });
    }
  },

  // Удалить компонент из набора
  async removeComponent(req: Request, res: Response) {
    try {
      const { id, componentId } = req.params;

      const result = await kitComponentRepository.delete({
        kit_id: id,
        component_id: componentId
      });

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Компонент не найден в наборе' });
      }

      res.json({ message: 'Компонент удалён из набора' });
    } catch (error) {
      console.error('Ошибка при удалении компонента из набора:', error);
      res.status(500).json({ error: 'Ошибка при удалении компонента из набора' });
    }
  }
};
