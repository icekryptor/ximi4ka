import path from 'path';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Employee } from '../entities/Employee';
import { memoryUpload, uploadToStorage, deleteFromStorage, BUCKETS } from '../utils/supabaseStorage';

export const uploadPhoto = memoryUpload(
  { fileSize: 5 * 1024 * 1024 },
  (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Разрешены только изображения'));
  }
);

const employeeRepository = AppDataSource.getRepository(Employee);

async function savePhoto(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  return uploadToStorage(BUCKETS.employees, filename, file.buffer, file.mimetype);
}

export const employeeController = {
  async getAll(_req: Request, res: Response) {
    try {
      const employees = await employeeRepository.find({ order: { name: 'ASC' } });
      res.json(employees);
    } catch (error) {
      console.error('Ошибка при получении сотрудников:', error);
      res.status(500).json({ error: 'Ошибка при получении сотрудников' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const employee = await employeeRepository.findOne({ where: { id: req.params.id } });
      if (!employee) return res.status(404).json({ error: 'Сотрудник не найден' });
      res.json(employee);
    } catch (error) {
      console.error('Ошибка при получении сотрудника:', error);
      res.status(500).json({ error: 'Ошибка при получении сотрудника' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = { ...req.body };
      if (req.file) data.photo_url = await savePhoto(req.file);
      if (data.hourly_rate) data.hourly_rate = Number(data.hourly_rate);
      const employee = employeeRepository.create(data);
      const saved = await employeeRepository.save(employee);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при создании сотрудника:', error);
      res.status(500).json({ error: 'Ошибка при создании сотрудника' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const employee = await employeeRepository.findOne({ where: { id } });
      if (!employee) return res.status(404).json({ error: 'Сотрудник не найден' });

      const data = { ...req.body };
      if (req.file) {
        if (employee.photo_url) await deleteFromStorage(BUCKETS.employees, employee.photo_url);
        data.photo_url = await savePhoto(req.file);
      }
      if (data.hourly_rate !== undefined) data.hourly_rate = Number(data.hourly_rate);
      if (data.is_active !== undefined) data.is_active = data.is_active === 'true' || data.is_active === true;

      await employeeRepository.update(id, data);
      const updated = await employeeRepository.findOne({ where: { id } });
      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении сотрудника:', error);
      res.status(500).json({ error: 'Ошибка при обновлении сотрудника' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await employeeRepository.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Сотрудник не найден' });
      res.json({ message: 'Сотрудник удалён' });
    } catch (error) {
      console.error('Ошибка при удалении сотрудника:', error);
      res.status(500).json({ error: 'Ошибка при удалении сотрудника' });
    }
  },
};
