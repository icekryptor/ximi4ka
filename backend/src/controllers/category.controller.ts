import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Category } from '../entities/Category';

const categoryRepository = AppDataSource.getRepository(Category);

// Поля, которые разрешено создавать / обновлять через API
const ALLOWED_FIELDS = [
  'name',
  'type',
  'color',
  'description',
  'is_active',
  'group',
  'parent_id',
  'cashflow_section',
] as const;

function pickAllowed(body: any): Partial<Category> {
  const out: any = {};
  for (const key of ALLOWED_FIELDS) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  // Нормализация пустой строки → null для опциональных строковых FK/enum
  if (out.parent_id === '' ) out.parent_id = null;
  if (out.cashflow_section === '') out.cashflow_section = null;
  return out;
}

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

      // Возвращаем сущности целиком — parent_id и cashflow_section включены автоматически.
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
      const payload = pickAllowed(req.body);
      const category = categoryRepository.create(payload);
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

      const payload = pickAllowed(req.body);
      // Нельзя сделать категорию своим же родителем
      if (payload.parent_id === id) {
        return res.status(400).json({ error: 'Категория не может быть родителем самой себя' });
      }
      await categoryRepository.update(id, payload);
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
