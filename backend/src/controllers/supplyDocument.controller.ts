import path from 'path';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { SupplyDocument } from '../entities/SupplyDocument';
import { Supply } from '../entities/Supply';
import { memoryUpload, uploadToStorage, deleteFromStorage, BUCKETS } from '../utils/supabaseStorage';

const docRepo    = AppDataSource.getRepository(SupplyDocument);
const supplyRepo = AppDataSource.getRepository(Supply);

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const uploadDoc = memoryUpload(
  { fileSize: 20 * 1024 * 1024 },
  (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Неподдерживаемый тип файла'));
  }
);

export const supplyDocumentController = {

  async getAll(req: Request, res: Response) {
    try {
      const { supplyId } = req.params;
      const docs = await docRepo.find({
        where: { supply_id: supplyId },
        order: { created_at: 'ASC' },
      });
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка получения документов' });
    }
  },

  async upload(req: Request, res: Response) {
    try {
      const { supplyId } = req.params;
      const supply = await supplyRepo.findOne({ where: { id: supplyId } });
      if (!supply) return res.status(404).json({ error: 'Поставка не найдена' });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: 'Файлы не переданы' });

      const savedDocs = await Promise.all(files.map(async file => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName);
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const file_url = await uploadToStorage(BUCKETS.supplyDocs, filename, file.buffer, file.mimetype);

        return docRepo.create({
          supply_id:     supplyId,
          original_name: originalName,
          filename,
          file_url,
          doc_type:      req.body.doc_type || 'other',
          notes:         req.body.notes    || null,
        });
      }));

      const saved = await docRepo.save(savedDocs);
      res.status(201).json(saved);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка загрузки документа' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { docId } = req.params;
      const doc = await docRepo.findOne({ where: { id: docId } });
      if (!doc) return res.status(404).json({ error: 'Документ не найден' });

      await docRepo.update(docId, {
        doc_type: req.body.doc_type ?? doc.doc_type,
        notes:    req.body.notes !== undefined ? req.body.notes : doc.notes,
      });

      const updated = await docRepo.findOne({ where: { id: docId } });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка обновления документа' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { docId } = req.params;
      const doc = await docRepo.findOne({ where: { id: docId } });
      if (!doc) return res.status(404).json({ error: 'Документ не найден' });

      if (doc.file_url) await deleteFromStorage(BUCKETS.supplyDocs, doc.file_url);

      await docRepo.delete(docId);
      res.json({ message: 'Документ удалён' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка удаления документа' });
    }
  },
};
