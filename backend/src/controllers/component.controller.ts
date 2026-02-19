import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Component } from '../entities/Component';
import { ComponentPart } from '../entities/ComponentPart';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Разрешены только изображения'));
  }
});

const componentRepository = AppDataSource.getRepository(Component);
const componentPartRepository = AppDataSource.getRepository(ComponentPart);

/** Пересчитать unit_price и weight_kg сложного компонента из его деталей */
async function recalculateComposite(compositeId: string) {
  const parts = await componentPartRepository.find({
    where: { composite_id: compositeId },
    relations: ['part'],
  });

  const totalPrice = parts.reduce(
    (s, p) => s + Number(p.part.unit_price) * Number(p.quantity),
    0,
  );
  const totalWeight = parts.reduce(
    (s, p) => s + (Number(p.part.weight_kg) || 0) * Number(p.quantity),
    0,
  );

  await componentRepository.update(compositeId, {
    unit_price: totalPrice,
    price_per_kit: totalPrice,
    ...(totalWeight > 0 ? { weight_kg: totalWeight } : {}),
  });
}

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
        relations: ['supplier'],
      });

      if (!component) {
        return res.status(404).json({ error: 'Компонент не найден' });
      }

      // Для сложных компонентов сразу вернуть состав
      if (component.is_composite) {
        const parts = await componentPartRepository.find({
          where: { composite_id: id },
          relations: ['part'],
          order: { created_at: 'ASC' },
        });
        (component as any).parts = parts;
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

  // Загрузить изображение компонента
  async uploadImage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const component = await componentRepository.findOne({ where: { id } });

      if (!component) {
        return res.status(404).json({ error: 'Компонент не найден' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      // Удалить старое изображение если есть
      if (component.image_url) {
        const oldPath = path.join(__dirname, '..', '..', component.image_url.replace('/uploads/', 'uploads/'));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const image_url = `/uploads/${req.file.filename}`;
      await componentRepository.update(id, { image_url });

      res.json({ image_url });
    } catch (error) {
      console.error('Ошибка при загрузке изображения:', error);
      res.status(500).json({ error: 'Ошибка при загрузке изображения' });
    }
  },

  // Получить состав сложного компонента
  async getParts(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parts = await componentPartRepository.find({
        where: { composite_id: id },
        relations: ['part'],
        order: { created_at: 'ASC' },
      });
      res.json(parts);
    } catch (error) {
      console.error('Ошибка при получении состава:', error);
      res.status(500).json({ error: 'Ошибка при получении состава' });
    }
  },

  // Добавить деталь в сложный компонент
  async addPart(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { part_id, quantity = 1 } = req.body;

      const composite = await componentRepository.findOne({ where: { id } });
      if (!composite) return res.status(404).json({ error: 'Компонент не найден' });
      if (!composite.is_composite)
        return res.status(400).json({ error: 'Компонент не является сложным' });

      const part = await componentRepository.findOne({ where: { id: part_id } });
      if (!part) return res.status(404).json({ error: 'Деталь не найдена' });
      if (part.is_composite)
        return res.status(400).json({ error: 'Нельзя добавить сложный компонент в состав' });
      if (part_id === id)
        return res.status(400).json({ error: 'Компонент не может содержать сам себя' });

      const existing = await componentPartRepository.findOne({
        where: { composite_id: id, part_id },
      });
      if (existing)
        return res.status(409).json({ error: 'Деталь уже добавлена в состав' });

      const entry = componentPartRepository.create({ composite_id: id, part_id, quantity });
      await componentPartRepository.save(entry);
      await recalculateComposite(id);

      const saved = await componentPartRepository.findOne({
        where: { id: entry.id },
        relations: ['part'],
      });
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при добавлении детали:', error);
      res.status(500).json({ error: 'Ошибка при добавлении детали' });
    }
  },

  // Обновить количество детали
  async updatePart(req: Request, res: Response) {
    try {
      const { id, partEntryId } = req.params;
      const { quantity } = req.body;

      if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0)
        return res.status(400).json({ error: 'Укажите корректное количество' });

      const entry = await componentPartRepository.findOne({
        where: { id: partEntryId, composite_id: id },
      });
      if (!entry) return res.status(404).json({ error: 'Запись не найдена' });

      await componentPartRepository.update(partEntryId, { quantity: Number(quantity) });
      await recalculateComposite(id);
      res.json({ message: 'Количество обновлено' });
    } catch (error) {
      console.error('Ошибка при обновлении детали:', error);
      res.status(500).json({ error: 'Ошибка при обновлении детали' });
    }
  },

  // Удалить деталь из состава
  async removePart(req: Request, res: Response) {
    try {
      const { id, partEntryId } = req.params;
      const result = await componentPartRepository.delete({
        id: partEntryId,
        composite_id: id,
      });
      if (result.affected === 0)
        return res.status(404).json({ error: 'Запись не найдена' });

      await recalculateComposite(id);
      res.json({ message: 'Деталь удалена из состава' });
    } catch (error) {
      console.error('Ошибка при удалении детали:', error);
      res.status(500).json({ error: 'Ошибка при удалении детали' });
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
