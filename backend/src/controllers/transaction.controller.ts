import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Transaction, TransactionType, TransactionSource } from '../entities/Transaction';
import { Category } from '../entities/Category';
import { Counterparty } from '../entities/Counterparty';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import ExcelJS from 'exceljs';

const transactionRepository = AppDataSource.getRepository(Transaction);

export const transactionController = {
  // Получить все транзакции с фильтрами и пагинацией
  async getAll(req: Request, res: Response) {
    try {
      const { type, startDate, endDate, categoryId, counterpartyId } = req.query;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));

      let where: any = {};

      if (type) where.type = type;
      if (categoryId) where.category_id = categoryId;
      if (counterpartyId) where.counterparty_id = counterpartyId;

      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate as string));
      }

      const [transactions, total] = await transactionRepository.findAndCount({
        where,
        relations: ['category', 'counterparty'],
        order: { date: 'DESC', created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Set pagination headers for frontend
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(page));
      res.set('X-Limit', String(limit));
      res.set('X-Total-Pages', String(Math.ceil(total / limit)));
      res.json(transactions);
    } catch (error) {
      console.error('Ошибка при получении транзакций:', error);
      res.status(500).json({ error: 'Ошибка при получении транзакций' });
    }
  },

  // Получить транзакцию по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await transactionRepository.findOne({
        where: { id },
        relations: ['category', 'counterparty']
      });

      if (!transaction) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      res.json(transaction);
    } catch (error) {
      console.error('Ошибка при получении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при получении транзакции' });
    }
  },

  // Создать транзакцию
  async create(req: Request, res: Response) {
    try {
      const transaction = transactionRepository.create(req.body);
      const result = await transactionRepository.insert(transaction);
      const savedId = result.identifiers[0].id;

      const fullTransaction = await transactionRepository.findOne({
        where: { id: savedId },
        relations: ['category', 'counterparty']
      });

      res.status(201).json(fullTransaction);
    } catch (error) {
      console.error('Ошибка при создании транзакции:', error);
      res.status(500).json({ error: 'Ошибка при создании транзакции' });
    }
  },

  // Обновить транзакцию
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await transactionRepository.findOne({ where: { id } });

      if (!transaction) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      await transactionRepository.update(id, req.body);
      
      const updatedTransaction = await transactionRepository.findOne({
        where: { id },
        relations: ['category', 'counterparty']
      });

      res.json(updatedTransaction);
    } catch (error) {
      console.error('Ошибка при обновлении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при обновлении транзакции' });
    }
  },

  // Удалить транзакцию
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await transactionRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Транзакция не найдена' });
      }

      res.json({ message: 'Транзакция удалена' });
    } catch (error) {
      console.error('Ошибка при удалении транзакции:', error);
      res.status(500).json({ error: 'Ошибка при удалении транзакции' });
    }
  },

  // ===== EXPORT =====
  async exportXlsx(req: Request, res: Response) {
    try {
      const { type, startDate, endDate, categoryId, counterpartyId } = req.query;

      let where: any = {};
      if (type) where.type = type;
      if (categoryId) where.category_id = categoryId;
      if (counterpartyId) where.counterparty_id = counterpartyId;
      if (startDate && endDate) {
        where.date = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        where.date = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        where.date = LessThanOrEqual(new Date(endDate as string));
      }

      const transactions = await transactionRepository.find({
        where,
        relations: ['category', 'counterparty'],
        order: { date: 'DESC', created_at: 'DESC' },
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Транзакции');

      // Header
      const headerRow = sheet.addRow([
        'Тип', 'Дата', 'Описание', 'Сумма', 'Категория',
        'Контрагент', 'Номер документа', 'Заметки', 'Источник',
      ]);
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E5EF' } };
      });

      // Column widths
      sheet.columns = [
        { width: 10 }, { width: 14 }, { width: 40 }, { width: 14 },
        { width: 20 }, { width: 25 }, { width: 20 }, { width: 30 }, { width: 12 },
      ];

      // Data
      for (const t of transactions) {
        const typeLabel = t.type === TransactionType.INCOME ? 'Доход' : 'Расход';
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('ru-RU') : '';
        sheet.addRow([
          typeLabel, dateStr, t.description, Number(t.amount),
          t.category?.name || '', t.counterparty?.name || '',
          t.document_number || '', t.notes || '', t.source || 'manual',
        ]);
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=transactions.xlsx'
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      res.status(500).json({ error: 'Ошибка экспорта' });
    }
  },

  // ===== IMPORT PREVIEW =====
  async importXlsx(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      const categoryRepo = AppDataSource.getRepository(Category);
      const counterpartyRepo = AppDataSource.getRepository(Counterparty);

      const [categories, counterpartiesAll] = await Promise.all([
        categoryRepo.find(),
        counterpartyRepo.find(),
      ]);

      const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
      const cpByName = new Map(counterpartiesAll.map((c) => [c.name.toLowerCase(), c]));

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer as any);
      const sheet = workbook.worksheets[0];

      if (!sheet) {
        return res.status(400).json({ error: 'Пустой файл' });
      }

      const parsed: any[] = [];
      const errors: string[] = [];
      let rowNum = 0;

      sheet.eachRow((row, idx) => {
        if (idx === 1) return; // skip header
        rowNum++;

        const typeRaw = String(row.getCell(1).value || '').trim();
        const dateRaw = String(row.getCell(2).value || '').trim();
        const description = String(row.getCell(3).value || '').trim();
        const amount = Number(row.getCell(4).value) || 0;
        const categoryName = String(row.getCell(5).value || '').trim();
        const counterpartyName = String(row.getCell(6).value || '').trim();
        const documentNumber = String(row.getCell(7).value || '').trim();
        const notes = String(row.getCell(8).value || '').trim();
        const sourceRaw = String(row.getCell(9).value || '').trim();

        // Skip supply transactions
        if (sourceRaw === 'supply') return;

        // Parse type
        let type: TransactionType;
        if (typeRaw === 'Доход' || typeRaw === 'income') type = TransactionType.INCOME;
        else if (typeRaw === 'Расход' || typeRaw === 'expense') type = TransactionType.EXPENSE;
        else {
          errors.push(`Строка ${idx}: неизвестный тип "${typeRaw}"`);
          return;
        }

        // Parse date (DD.MM.YYYY or YYYY-MM-DD)
        let date: string;
        if (dateRaw.includes('.')) {
          const parts = dateRaw.split('.');
          date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (dateRaw.includes('-')) {
          date = dateRaw;
        } else {
          errors.push(`Строка ${idx}: неверный формат даты "${dateRaw}"`);
          return;
        }

        if (!description || !amount) {
          errors.push(`Строка ${idx}: пустое описание или нулевая сумма`);
          return;
        }

        const cat = categoryName ? catByName.get(categoryName.toLowerCase()) : null;
        const cp = counterpartyName ? cpByName.get(counterpartyName.toLowerCase()) : null;

        parsed.push({
          row: idx,
          type,
          date,
          description,
          amount,
          category_id: cat?.id || null,
          category_name: categoryName,
          counterparty_id: cp?.id || null,
          counterparty_name: counterpartyName,
          document_number: documentNumber || null,
          notes: notes || null,
        });
      });

      // Deduplication — only load transactions matching dates in the import
      const importDates = [...new Set(parsed.map((r: any) => r.date))];
      const importDocNums = parsed
        .filter((r: any) => r.document_number)
        .map((r: any) => r.document_number.toLowerCase());

      let existingTx: { date: any; amount: number; counterparty_id: string | null; description: string; document_number: string | null }[] = [];
      if (importDates.length > 0) {
        const qb = transactionRepository.createQueryBuilder('t')
          .select(['t.date', 't.amount', 't.counterparty_id', 't.description', 't.document_number']);

        if (importDocNums.length > 0) {
          qb.where('t.date IN (:...dates) OR LOWER(t.document_number) IN (:...docNums)', {
            dates: importDates,
            docNums: importDocNums,
          });
        } else {
          qb.where('t.date IN (:...dates)', { dates: importDates });
        }
        existingTx = await qb.getMany();
      }

      const existByDocNum = new Set(
        existingTx.filter((t) => t.document_number).map((t) => t.document_number!.toLowerCase())
      );
      const existByComposite = new Set(
        existingTx.map(
          (t) => `${String(t.date).split('T')[0]}|${Number(t.amount)}|${t.counterparty_id || ''}|${t.description}`
        )
      );

      let duplicates = 0;
      for (const row of parsed) {
        const isDup =
          (row.document_number && existByDocNum.has(row.document_number.toLowerCase())) ||
          existByComposite.has(`${row.date}|${row.amount}|${row.counterparty_id || ''}|${row.description}`);
        row.is_duplicate = !!isDup;
        if (isDup) duplicates++;
      }

      res.json({
        parsed,
        duplicates,
        newRows: parsed.length - duplicates,
        errors,
        total: parsed.length,
      });
    } catch (error) {
      console.error('Ошибка импорта:', error);
      res.status(500).json({ error: 'Ошибка при разборе файла' });
    }
  },

  // ===== IMPORT CONFIRM =====
  async confirmImport(req: Request, res: Response) {
    try {
      const { rows } = req.body;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Нет данных для импорта' });
      }

      const entities = rows.map((row: any) => ({
        type: row.type,
        amount: row.amount,
        description: row.description,
        date: row.date,
        category_id: row.category_id || null,
        counterparty_id: row.counterparty_id || null,
        document_number: row.document_number || null,
        notes: row.notes || null,
        source: TransactionSource.IMPORT,
      }));

      // Bulk insert in batches of 500 for safety
      let imported = 0;
      await AppDataSource.manager.transaction(async (em) => {
        for (let i = 0; i < entities.length; i += 500) {
          const batch = entities.slice(i, i + 500);
          await em.createQueryBuilder()
            .insert()
            .into(Transaction)
            .values(batch)
            .execute();
          imported += batch.length;
        }
      });

      res.json({ imported });
    } catch (error) {
      console.error('Ошибка подтверждения импорта:', error);
      res.status(500).json({ error: 'Ошибка при импорте транзакций' });
    }
  },
};
