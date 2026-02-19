import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Category } from '../entities/Category';

const categoryRepository = AppDataSource.getRepository(Category);

export const categoryController = {
  // Получить все категории
  async getAll(req: Request, res: Response) {
    try {
      const { type, active } = req.query;
      
      let where: any = {};
      
      if (type) where.type = type;
      if (active !== undefined) where.is_active = active === 'true';

      const categories = await categoryRepository.find({
        where,
        order: { name: 'ASC' }
      });

      res.json(categories);
    } catch (error) {
      console.error('Ошибка при получении категорий:', error);
      res.status(500).json({ error: 'Ошибка при получении категорий' });
    }
  },

  // Получить категорию по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await categoryRepository.findOne({ where: { id } });

      if (!category) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      res.json(category);
    } catch (error) {
      console.error('Ошибка при получении категории:', error);
      res.status(500).json({ error: 'Ошибка при получении категории' });
    }
  },

  // Создать категорию
  async create(req: Request, res: Response) {
    try {
      const category = categoryRepository.create(req.body);
      const savedCategory = await categoryRepository.save(category);
      res.status(201).json(savedCategory);
    } catch (error) {
      console.error('Ошибка при создании категории:', error);
      res.status(500).json({ error: 'Ошибка при создании категории' });
    }
  },

  // Обновить категорию
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await categoryRepository.findOne({ where: { id } });

      if (!category) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      await categoryRepository.update(id, req.body);
      const updatedCategory = await categoryRepository.findOne({ where: { id } });

      res.json(updatedCategory);
    } catch (error) {
      console.error('Ошибка при обновлении категории:', error);
      res.status(500).json({ error: 'Ошибка при обновлении категории' });
    }
  },

  // Удалить категорию
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await categoryRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }

      res.json({ message: 'Категория удалена' });
    } catch (error) {
      console.error('Ошибка при удалении категории:', error);
      res.status(500).json({ error: 'Ошибка при удалении категории' });
    }
  }
};
