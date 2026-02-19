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
      const savedKit = await kitRepository.save(kit);

      // Добавляем компоненты если они есть
      if (components && Array.isArray(components)) {
        for (const comp of components) {
          const kitComponent = kitComponentRepository.create({
            kit_id: savedKit.id,
            component_id: comp.component_id,
            quantity: comp.quantity,
            notes: comp.notes
          });
          await kitComponentRepository.save(kitComponent);
        }
      }

      const fullKit = await kitRepository.findOne({
        where: { id: savedKit.id },
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

      // Получаем все компоненты набора
      const components = await componentRepository.find({
        where: { is_active: true }
      });

      // Группируем по категориям
      const reagents = components.filter(c => c.category === ComponentCategory.REAGENT);
      const equipment = components.filter(c => c.category === ComponentCategory.EQUIPMENT);
      const printProducts = components.filter(c => c.category === ComponentCategory.PRINT);
      const labor = components.filter(c => c.category === ComponentCategory.LABOR);

      // Рассчитываем суммы
      const reagentsCost = reagents.reduce((sum, c) => sum + Number(c.price_per_kit), 0);
      const equipmentCost = equipment.reduce((sum, c) => sum + Number(c.price_per_kit), 0);
      const printCost = printProducts.reduce((sum, c) => sum + Number(c.price_per_kit), 0);
      const laborCost = labor.reduce((sum, c) => sum + Number(c.price_per_kit), 0);

      const totalCost = reagentsCost + equipmentCost + printCost + laborCost;

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
        total: totalCost,
        details: {
          reagents: reagents.map(c => ({
            name: c.name,
            cost: Number(c.price_per_kit)
          })),
          equipment: equipment.map(c => ({
            name: c.name,
            cost: Number(c.price_per_kit)
          })),
          print: printProducts.map(c => ({
            name: c.name,
            cost: Number(c.price_per_kit)
          })),
          labor: labor.map(c => ({
            name: c.name,
            cost: Number(c.price_per_kit)
          }))
        }
      });
    } catch (error) {
      console.error('Ошибка при расчете себестоимости:', error);
      res.status(500).json({ error: 'Ошибка при расчете себестоимости' });
    }
  }
};
