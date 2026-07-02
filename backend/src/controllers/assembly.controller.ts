import { Request, Response } from 'express';
import { Like } from 'typeorm';
import { AppDataSource } from '../config/database';
import { AssemblyOperation } from '../entities/AssemblyOperation';
import { AppSetting } from '../entities/AppSetting';
import { Component, ComponentCategory } from '../entities/Component';
import { ComponentPart } from '../entities/ComponentPart';

const opRepo = () => AppDataSource.getRepository(AssemblyOperation);
const settingRepo = () => AppDataSource.getRepository(AppSetting);
const componentRepo = () => AppDataSource.getRepository(Component);
const partRepo = () => AppDataSource.getRepository(ComponentPart);

const LABOR_RATE_KEY = 'labor_rate_per_hour';
const DEFAULT_LABOR_RATE = 500;
const ROOT_NAME_PREFIX = 'Набор в защитном коробе %';

const round2 = (n: number) => Math.round(n * 100) / 100;

async function getLaborRateValue(): Promise<number> {
  const setting = await settingRepo().findOne({ where: { key: LABOR_RATE_KEY } });
  const rate = Number(setting?.value);
  if (!setting || !Number.isFinite(rate) || rate <= 0) {
    console.warn(`[assembly] Ставка труда не задана в app_settings — используется дефолт ${DEFAULT_LABOR_RATE} ₽/ч`);
    return DEFAULT_LABOR_RATE;
  }
  return rate;
}

interface TreeOperation {
  id: string;
  name: string;
  stage: number;
  timeSeconds: number | null;
  laborCost: number;
  instructionSlug: string | null;
}

interface TreeNode {
  id: string;
  name: string;
  isComposite: boolean;
  stageMax: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  quantity: number;
  operations: TreeOperation[];
  children: TreeNode[];
}

export const assemblyController = {
  // GET /api/assembly/roots — корневые наборы («Набор в защитном коробе …»)
  async roots(_req: Request, res: Response) {
    try {
      const roots = await componentRepo().find({
        select: ['id', 'name'],
        where: { name: Like(ROOT_NAME_PREFIX) },
        order: { name: 'ASC' },
      });
      res.json(roots.map((r) => ({ id: r.id, name: r.name })));
    } catch (e: any) {
      console.error('[assembly.roots]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки корневых наборов' });
    }
  },

  // GET /api/assembly/tree?root=<uuid> — всё дерево + rollup себестоимости (3 batch-запроса)
  async tree(req: Request, res: Response) {
    try {
      const rootId = String(req.query.root || '');
      if (!rootId) return res.status(400).json({ error: 'Параметр root обязателен' });

      const [parts, components, operations, rate] = await Promise.all([
        partRepo().find(),
        componentRepo().find({
          select: ['id', 'name', 'category', 'is_composite', 'unit_price', 'price_per_gram'],
        }),
        opRepo().find({ order: { stage: 'ASC', sort_order: 'ASC' } }),
        getLaborRateValue(),
      ]);

      const componentsById = new Map(components.map((c) => [c.id, c]));
      const root = componentsById.get(rootId);
      if (!root) return res.status(404).json({ error: 'Корневой компонент не найден' });

      const partsByComposite = new Map<string, ComponentPart[]>();
      for (const p of parts) {
        const list = partsByComposite.get(p.composite_id);
        if (list) list.push(p);
        else partsByComposite.set(p.composite_id, [p]);
      }
      const opsByComposite = new Map<string, AssemblyOperation[]>();
      for (const o of operations) {
        const list = opsByComposite.get(o.composite_id);
        if (list) list.push(o);
        else opsByComposite.set(o.composite_id, [o]);
      }

      const warnings: string[] = [];

      // Обход с visited-set по текущему пути (предки): цикл обрубается с warning,
      // при этом легитимные повторы компонента в разных ветках не режутся.
      // Rollup копится в неокруглённых значениях (exactTotal), округление — только для отображения,
      // иначе накапливается ошибка (контрольный «Раствор сульфата меди 5%» = 8.05, а не 8.06).
      const buildNode = (
        componentId: string,
        quantity: number,
        path: Set<string>
      ): { node: TreeNode; exactTotal: number } | null => {
        const comp = componentsById.get(componentId);
        if (!comp) {
          warnings.push(`Компонент ${componentId} не найден — ветка пропущена`);
          return null;
        }
        if (path.has(componentId)) {
          warnings.push(`Цикл в дереве: «${comp.name}» встречается среди собственных предков — ветка обрезана`);
          return null;
        }

        const ops = opsByComposite.get(componentId) || [];
        const opShapes: TreeOperation[] = ops.map((o) => ({
          id: o.id,
          name: o.name,
          stage: o.stage,
          timeSeconds: o.time_seconds,
          laborCost: o.time_seconds ? round2((o.time_seconds / 3600) * rate) : 0,
          instructionSlug: o.instruction_slug,
        }));
        const stageMax = ops.reduce((m, o) => Math.max(m, o.stage), 0);

        const children: TreeNode[] = [];
        let materialPerUnit = 0;
        if (comp.is_composite) {
          path.add(componentId);
          for (const part of partsByComposite.get(componentId) || []) {
            const child = buildNode(part.part_id, Number(part.quantity) || 0, path);
            if (child) {
              children.push(child.node);
              materialPerUnit += child.exactTotal;
            }
          }
          path.delete(componentId);
        } else {
          const price =
            comp.category === ComponentCategory.REAGENT || comp.category === ComponentCategory.METAL
              ? comp.price_per_gram
              : comp.unit_price;
          materialPerUnit = Number(price) || 0;
        }

        const laborPerUnit = ops.reduce(
          (s, o) => s + (o.time_seconds ? (o.time_seconds / 3600) * rate : 0),
          0
        );
        const exactMaterial = materialPerUnit * quantity;
        const exactLabor = laborPerUnit * quantity;
        const exactTotal = exactMaterial + exactLabor;

        return {
          exactTotal,
          node: {
            id: comp.id,
            name: comp.name,
            isComposite: comp.is_composite,
            stageMax,
            materialCost: round2(exactMaterial),
            laborCost: round2(exactLabor),
            totalCost: round2(exactTotal),
            quantity,
            operations: opShapes,
            children,
          },
        };
      };

      const tree = buildNode(rootId, 1, new Set<string>())?.node ?? null;
      res.json({ tree, meta: { laborRate: rate, warnings } });
    } catch (e: any) {
      console.error('[assembly.tree]', e?.message || e);
      res.status(500).json({ error: 'Ошибка построения дерева сборки' });
    }
  },

  // POST /api/assembly/operations
  async createOperation(req: Request, res: Response) {
    try {
      const { composite_id, name, stage, time_seconds, instruction_slug, sort_order } = req.body as {
        composite_id?: string;
        name?: string;
        stage?: number;
        time_seconds?: number | null;
        instruction_slug?: string | null;
        sort_order?: number;
      };
      if (!composite_id || !name || !String(name).trim()) {
        return res.status(400).json({ error: 'composite_id и name обязательны' });
      }
      const composite = await componentRepo().findOne({ where: { id: composite_id } });
      if (!composite) return res.status(404).json({ error: 'Композит не найден' });

      const timeSeconds = time_seconds == null ? null : Number(time_seconds);
      if (timeSeconds !== null && (!Number.isFinite(timeSeconds) || timeSeconds < 0)) {
        return res.status(400).json({ error: 'time_seconds должен быть неотрицательным числом' });
      }

      const op = opRepo().create({
        composite_id,
        name: String(name).trim(),
        stage: Number.isFinite(Number(stage)) ? Number(stage) : 0,
        time_seconds: timeSeconds,
        instruction_slug: instruction_slug || null,
        sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      });
      const saved = await opRepo().save(op);
      res.status(201).json(saved);
    } catch (e: any) {
      console.error('[assembly.createOperation]', e?.message || e);
      res.status(500).json({ error: 'Ошибка создания операции' });
    }
  },

  // PUT /api/assembly/operations/:id (partial)
  async updateOperation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, stage, time_seconds, instruction_slug, sort_order } = req.body as {
        name?: string;
        stage?: number;
        time_seconds?: number | null;
        instruction_slug?: string | null;
        sort_order?: number;
      };

      const patch: Partial<AssemblyOperation> = {};
      if (name !== undefined) {
        if (!String(name).trim()) return res.status(400).json({ error: 'name не может быть пустым' });
        patch.name = String(name).trim();
      }
      if (stage !== undefined) {
        const s = Number(stage);
        if (!Number.isFinite(s)) return res.status(400).json({ error: 'stage должен быть числом' });
        patch.stage = s;
      }
      if (time_seconds !== undefined) {
        if (time_seconds === null) {
          patch.time_seconds = null;
        } else {
          const t = Number(time_seconds);
          if (!Number.isFinite(t) || t < 0) {
            return res.status(400).json({ error: 'time_seconds должен быть неотрицательным числом' });
          }
          patch.time_seconds = t;
        }
      }
      if (instruction_slug !== undefined) patch.instruction_slug = instruction_slug || null;
      if (sort_order !== undefined) {
        const so = Number(sort_order);
        if (!Number.isFinite(so)) return res.status(400).json({ error: 'sort_order должен быть числом' });
        patch.sort_order = so;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Нет полей для обновления' });
      }

      await opRepo().update(id, patch);
      const updated = await opRepo().findOne({ where: { id } });
      if (!updated) return res.status(404).json({ error: 'Операция не найдена' });
      res.json(updated);
    } catch (e: any) {
      console.error('[assembly.updateOperation]', e?.message || e);
      res.status(500).json({ error: 'Ошибка обновления операции' });
    }
  },

  // DELETE /api/assembly/operations/:id
  async deleteOperation(req: Request, res: Response) {
    try {
      const r = await opRepo().delete(req.params.id);
      if (r.affected === 0) return res.status(404).json({ error: 'Операция не найдена' });
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[assembly.deleteOperation]', e?.message || e);
      res.status(500).json({ error: 'Ошибка удаления операции' });
    }
  },

  // GET /api/assembly/settings/labor-rate
  async getLaborRate(_req: Request, res: Response) {
    try {
      const rate = await getLaborRateValue();
      res.json({ rate });
    } catch (e: any) {
      console.error('[assembly.getLaborRate]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки ставки труда' });
    }
  },

  // PUT /api/assembly/settings/labor-rate { rate } (upsert app_settings)
  async setLaborRate(req: Request, res: Response) {
    try {
      const rate = Number(req.body?.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return res.status(400).json({ error: 'rate должен быть положительным числом' });
      }
      await settingRepo().save({ key: LABOR_RATE_KEY, value: rate });
      res.json({ rate });
    } catch (e: any) {
      console.error('[assembly.setLaborRate]', e?.message || e);
      res.status(500).json({ error: 'Ошибка сохранения ставки труда' });
    }
  },
};
