import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Component, ComponentCategory } from '../entities/Component';
import { ComponentPart } from '../entities/ComponentPart';
import { SupplyItem } from '../entities/SupplyItem';

const componentRepo = () => AppDataSource.getRepository(Component);
const partRepo      = () => AppDataSource.getRepository(ComponentPart);
const itemRepo      = () => AppDataSource.getRepository(SupplyItem);

const WEIGHT_CATEGORIES = new Set([ComponentCategory.REAGENT, ComponentCategory.METAL]);

function partContribution(part: Component, qty: number) {
  const isWeightBased = WEIGHT_CATEGORIES.has(part.category);
  const factor    = isWeightBased ? qty / 1000 : qty;
  return {
    materials: Number(part.cost_materials) * factor,
    logistics: Number(part.cost_logistics) * factor,
    weight:    (Number(part.weight_kg) || 0) * factor,
  };
}

/**
 * BFS вверх по дереву: пересчитать все СК, чьи части изменились.
 * Батчинг: загружаем все composites и их parts за 2 запроса на уровень.
 */
export async function syncCompositeCosts(changedIds: string[]) {
  let frontier = [...new Set(changedIds)];
  const visited = new Set<string>();

  while (frontier.length > 0) {
    const rows = await partRepo()
      .createQueryBuilder('cp')
      .select('DISTINCT cp.composite_id', 'composite_id')
      .where('cp.part_id IN (:...ids)', { ids: frontier })
      .getRawMany<{ composite_id: string }>();

    const compositeIds = rows
      .map(r => r.composite_id)
      .filter(id => !visited.has(id));

    if (compositeIds.length === 0) break;

    // Batch: load all composites + all their parts in 2 queries
    const [composites, allParts] = await Promise.all([
      componentRepo().find({ where: { id: In(compositeIds) } }),
      partRepo().find({
        where: { composite_id: In(compositeIds) },
        relations: ['part'],
      }),
    ]);

    const partsMap = new Map<string, ComponentPart[]>();
    for (const p of allParts) {
      const list = partsMap.get(p.composite_id) || [];
      list.push(p);
      partsMap.set(p.composite_id, list);
    }

    for (const composite of composites) {
      const parts = partsMap.get(composite.id) || [];

      let cost_materials = 0;
      let cost_logistics = 0;

      for (const cp of parts) {
        if (!cp.part) continue;
        const c = partContribution(cp.part, Number(cp.quantity));
        cost_materials += c.materials;
        cost_logistics += c.logistics;
      }

      const cost_labor = Number(composite.cost_labor);
      const unit_price = cost_materials + cost_logistics + cost_labor;

      await componentRepo().update(composite.id, {
        cost_materials,
        cost_logistics,
        unit_price,
        price_per_kit: unit_price * Number(composite.quantity_per_kit),
      });

      visited.add(composite.id);
    }

    frontier = compositeIds;
  }
}

/**
 * Обновить cost_materials и cost_logistics компонентов на основе последней поставки.
 * Батчинг: загружаем все компоненты за 1 запрос, находим последние supply items за 1 запрос.
 */
export async function syncComponentCosts(componentIds: string[]) {
  const uniqueIds = [...new Set(componentIds)];
  if (uniqueIds.length === 0) return;

  // Batch: load all components at once
  const components = await componentRepo().find({ where: { id: In(uniqueIds) } });
  const componentMap = new Map(components.map(c => [c.id, c]));

  // Batch: find latest supply item per component using a single subquery
  // For each component, get the most recent supply item
  const latestItems = await itemRepo()
    .createQueryBuilder('si')
    .innerJoin('si.supply', 's')
    .where('si.component_id IN (:...ids)', { ids: uniqueIds })
    .orderBy('s.created_at', 'DESC')
    .getMany();

  // Group by component_id, take the first (most recent due to ORDER BY)
  const latestMap = new Map<string, SupplyItem>();
  for (const item of latestItems) {
    if (!latestMap.has(item.component_id)) {
      latestMap.set(item.component_id, item);
    }
  }

  for (const cid of uniqueIds) {
    const component = componentMap.get(cid);
    if (!component) continue;

    const latest = latestMap.get(cid);
    const cost_materials = latest ? Number(latest.unit_cost)          : 0;
    const cost_logistics = latest ? Number(latest.unit_delivery_cost) : 0;
    const cost_labor     = Number(component.cost_labor);
    const unit_price     = cost_materials + cost_logistics + cost_labor;

    await componentRepo().update(cid, {
      cost_materials,
      cost_logistics,
      unit_price,
      price_per_kit: unit_price * Number(component.quantity_per_kit),
    });
  }

  await syncCompositeCosts(uniqueIds);
}
