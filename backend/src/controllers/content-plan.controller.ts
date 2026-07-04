import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { BrandDoc } from '../entities/BrandDoc';
import { ContentPlanItem } from '../entities/ContentPlanItem';

const itemRepo = () => AppDataSource.getRepository(ContentPlanItem);
const docRepo = () => AppDataSource.getRepository(BrandDoc);

const PLAN_DOC_SLUG = 'content_plan_current';

export const contentPlanController = {
  async get(_req: Request, res: Response) {
    try {
      const doc = await docRepo().findOne({ where: { slug: PLAN_DOC_SLUG } });
      const items = await itemRepo().find({
        order: { sort_order: 'ASC', plan_date: 'ASC' },
      });
      res.json({
        doc: doc ? { title: doc.title, content: doc.content } : null,
        items,
      });
    } catch (e: any) {
      console.error('[content-plan.get]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки контент-плана' });
    }
  },

  async createItem(req: Request, res: Response) {
    try {
      const {
        plan_date,
        funnel_level,
        segment_id,
        theme_id,
        format,
        goal,
        status,
        sort_order,
      } = req.body as Partial<ContentPlanItem>;

      const item = itemRepo().create({
        plan_date: plan_date ?? null,
        funnel_level: funnel_level ?? null,
        segment_id: segment_id ?? null,
        theme_id: theme_id ?? null,
        format: format ?? null,
        goal: goal ?? null,
        status: status ?? 'planned',
        sort_order: sort_order ?? 0,
      });
      const saved = await itemRepo().save(item);
      res.status(201).json(saved);
    } catch (e: any) {
      console.error('[content-plan.createItem]', e?.message || e);
      res.status(500).json({ error: 'Ошибка создания строки плана' });
    }
  },

  async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const patch: Partial<ContentPlanItem> = {};
      const b = req.body as Partial<ContentPlanItem>;
      if ('plan_date' in b) patch.plan_date = b.plan_date ?? null;
      if ('funnel_level' in b) patch.funnel_level = b.funnel_level ?? null;
      if ('segment_id' in b) patch.segment_id = b.segment_id ?? null;
      if ('theme_id' in b) patch.theme_id = b.theme_id ?? null;
      if ('format' in b) patch.format = b.format ?? null;
      if ('goal' in b) patch.goal = b.goal ?? null;
      if ('status' in b && b.status) patch.status = b.status;
      if ('sort_order' in b && typeof b.sort_order === 'number') patch.sort_order = b.sort_order;

      await itemRepo().update(id, patch);
      const updated = await itemRepo().findOne({ where: { id } });
      if (!updated) return res.status(404).json({ error: 'Строка плана не найдена' });
      res.json(updated);
    } catch (e: any) {
      console.error('[content-plan.updateItem]', e?.message || e);
      res.status(500).json({ error: 'Ошибка обновления строки плана' });
    }
  },

  async deleteItem(req: Request, res: Response) {
    try {
      const r = await itemRepo().delete(req.params.id);
      if (r.affected === 0) return res.status(404).json({ error: 'Строка плана не найдена' });
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[content-plan.deleteItem]', e?.message || e);
      res.status(500).json({ error: 'Ошибка удаления строки плана' });
    }
  },
};
