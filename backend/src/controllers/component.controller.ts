import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Component } from '../entities/Component';

const componentRepository = AppDataSource.getRepository(Component);

export const componentController = {
  // Получить все компоненты
  async getAll(req: Request, res: Response) {
    try {
      const { category, active } = req.query;
      
      let where: any = {};
      
      if (category) where.category = category;
      if (active !== undefined) where.is_active = active === 'true';

      const components = await componentRepository.find({
        where,
        relations: ['supplier'],
        order: { category: 'ASC', name: 'ASC' }
      });

      res.json(components);
    } catch (error) {
      console.error('Ошибка при получении компонентов:', error);
      res.status(500).json({ error: 'Ошибка при получении компонентов' });
    }
  },

  // Получить компонент по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const component = await componentRepository.findOne({
        where: { id },
        relations: ['supplier']
      });

      if (!component) {
        return res.status(404).json({ error: 'Компонент не найден' });
      }

      res.json(component);
    } catch (error) {
      console.error('Ошибка при получении компонента:', error);
      res.status(500).json({ error: 'Ошибка при получении компонента' });
    }
  },

  // Создать компонент
  async create(req: Request, res: Response) {
    try {
      const component = componentRepository.create(req.body);
      const savedComponent = await componentRepository.save(component);
      res.status(201).json(savedComponent);
    } catch (error) {
      console.error('Ошибка при создании компонента:', error);
      res.status(500).json({ error: 'Ошибка при создании компонента' });
    }
  },

  // Обновить компонент
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const component = await componentRepository.findOne({ where: { id } });

      if (!component) {
        return res.status(404).json({ error: 'Компонент не найден' });
      }

      await componentRepository.update(id, req.body);
      const updatedComponent = await componentRepository.findOne({
        where: { id },
        relations: ['supplier']
      });

      res.json(updatedComponent);
    } catch (error) {
      console.error('Ошибка при обновлении компонента:', error);
      res.status(500).json({ error: 'Ошибка при обновлении компонента' });
    }
  },

  // Удалить компонент
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await componentRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Компонент не найден' });
      }

      res.json({ message: 'Компонент удален' });
    } catch (error) {
      console.error('Ошибка при удалении компонента:', error);
      res.status(500).json({ error: 'Ошибка при удалении компонента' });
    }
  },

  // Импорт данных из массива
  async bulkImport(req: Request, res: Response) {
    try {
      const { components } = req.body;

      if (!Array.isArray(components)) {
        return res.status(400).json({ error: 'Ожидается массив компонентов' });
      }

      const savedComponents = [];
      for (const componentData of components) {
        const component = componentRepository.create(componentData);
        const saved = await componentRepository.save(component);
        savedComponents.push(saved);
      }

      res.status(201).json({
        message: `Импортировано ${savedComponents.length} компонентов`,
        components: savedComponents
      });
    } catch (error) {
      console.error('Ошибка при импорте компонентов:', error);
      res.status(500).json({ error: 'Ошибка при импорте компонентов' });
    }
  }
};
