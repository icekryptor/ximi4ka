import path from 'path';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TaskComment } from '../entities/TaskComment';
import { User } from '../entities/User';
import { uploadToStorage, memoryUpload, deleteFromStorage } from '../utils/supabaseStorage';

const repo = () => AppDataSource.getRepository(TaskComment);
const userRepo = () => AppDataSource.getRepository(User);

export const uploadAttachment = memoryUpload(
  { fileSize: 10 * 1024 * 1024 },
);

export const taskCommentController = {
  async getAll(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const comments = await repo().find({
        where: { task_id: taskId },
        order: { created_at: 'ASC' },
      });

      const authorIds = [...new Set(comments.map(c => c.author_id))];
      let authorMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const users = await userRepo().find({ where: authorIds.map(id => ({ id })) });
        authorMap = Object.fromEntries(users.map(u => [u.id, u.name]));
      }

      const result = comments.map(c => ({
        ...c,
        author_name: authorMap[c.author_id] || 'Неизвестный',
      }));
      res.json(result);
    } catch (error) {
      console.error('Ошибка при получении комментариев:', error);
      res.status(500).json({ error: 'Ошибка при получении комментариев' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: 'Текст комментария обязателен' });

      let attachment_url: string | null = null;
      let attachment_name: string | null = null;

      if (req.file) {
        const ext = path.extname(req.file.originalname);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        attachment_url = await uploadToStorage('task-attachments', filename, req.file.buffer, req.file.mimetype);
        attachment_name = req.file.originalname;
      }

      const comment = repo().create({
        task_id: taskId,
        author_id: req.user!.userId,
        text: text.trim(),
        attachment_url: attachment_url as any,
        attachment_name: attachment_name as any,
      } as any);
      const saved = await repo().save(comment);

      const user = await userRepo().findOne({ where: { id: req.user!.userId } });
      res.status(201).json({ ...saved, author_name: user?.name || 'Неизвестный' });
    } catch (error) {
      console.error('Ошибка при создании комментария:', error);
      res.status(500).json({ error: 'Ошибка при создании комментария' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const comment = await repo().findOne({ where: { id } });
      if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

      if (comment.author_id !== req.user!.userId) {
        return res.status(403).json({ error: 'Можно удалять только свои комментарии' });
      }

      if (comment.attachment_url) {
        await deleteFromStorage('task-attachments', comment.attachment_url);
      }

      await repo().delete(id);
      res.json({ message: 'Комментарий удалён' });
    } catch (error) {
      console.error('Ошибка при удалении комментария:', error);
      res.status(500).json({ error: 'Ошибка при удалении комментария' });
    }
  },
};
