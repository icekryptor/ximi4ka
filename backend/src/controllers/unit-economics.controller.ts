import { Request, Response } from 'express';
import { DeepPartial } from 'typeorm';
import { AppDataSource } from '../config/database';
import { UnitEconomicsCalculation, VariableBlock } from '../entities/UnitEconomicsCalculation';
import { Kit } from '../entities/Kit';

const calcRepository = AppDataSource.getRepository(UnitEconomicsCalculation);
const kitRepository = AppDataSource.getRepository(Kit);

function calculateResults(
  sellerPrice: number,
  costPrice: number,
  taxRate: number,
  variableBlocks: VariableBlock[]
) {
  const taxAmount = sellerPrice * taxRate / 100;
  const variableTotal = variableBlocks.reduce((sum, block) => {
    if (block.value_type === 'percent') {
      return sum + sellerPrice * block.value / 100;
    }
    return sum + block.value;
  }, 0);
  const totalExpenses = costPrice + taxAmount + variableTotal;
  const profit = sellerPrice - totalExpenses;
  const margin = sellerPrice > 0 ? (profit / sellerPrice) * 100 : 0;

  return {
    tax_amount: Math.round(taxAmount * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    margin: Math.round(margin * 100) / 100,
  };
}

export const unitEconomicsController = {
  // Получить все расчёты (фильтр по kit_id и/или group_id)
  async getAll(req: Request, res: Response) {
    try {
      const { kit_id, group_id } = req.query;
      const where: any = {};
      if (kit_id) where.kit_id = kit_id;
      if (group_id) where.group_id = group_id;

      const calculations = await calcRepository.find({
        where,
        relations: ['kit'],
        order: { updated_at: 'DESC' },
      });

      res.json(calculations);
    } catch (error) {
      console.error('Ошибка при получении расчётов:', error);
      res.status(500).json({ error: 'Ошибка при получении расчётов' });
    }
  },

  // Получить расчёт по ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const calc = await calcRepository.findOne({
        where: { id },
        relations: ['kit'],
      });

      if (!calc) {
        return res.status(404).json({ error: 'Расчёт не найден' });
      }

      res.json(calc);
    } catch (error) {
      console.error('Ошибка при получении расчёта:', error);
      res.status(500).json({ error: 'Ошибка при получении расчёта' });
    }
  },

  // Создать расчёт
  async create(req: Request, res: Response) {
    try {
      const {
        kit_id,
        name,
        channel_name,
        seller_price = 0,
        start_price,
        seller_discount,
        marketplace_price,
        cost_type = 'estimated',
        tax_rate = 0,
        variable_blocks = [],
      } = req.body;

      if (!kit_id || !name || !channel_name) {
        return res.status(400).json({ error: 'Укажите kit_id, name и channel_name' });
      }

      const kit = await kitRepository.findOne({ where: { id: kit_id } });
      if (!kit) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      // Snapshot себестоимости
      const costPrice = cost_type === 'estimated'
        ? Number(kit.estimated_cost || 0)
        : Number(kit.total_cost || 0);

      const results = calculateResults(
        Number(seller_price),
        costPrice,
        Number(tax_rate),
        variable_blocks
      );

      const calc = calcRepository.create({
        kit_id,
        name,
        channel_name,
        seller_price,
        start_price: start_price ?? null,
        seller_discount: seller_discount ?? null,
        marketplace_price: marketplace_price ?? null,
        cost_type,
        tax_rate,
        variable_blocks,
        cost_price: costPrice,
        ...results,
      });

      const saved = await calcRepository.save(calc);
      const full = await calcRepository.findOne({
        where: { id: saved.id },
        relations: ['kit'],
      });

      res.status(201).json(full);
    } catch (error) {
      console.error('Ошибка при создании расчёта:', error);
      res.status(500).json({ error: 'Ошибка при создании расчёта' });
    }
  },

  // Обновить расчёт
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const calc = await calcRepository.findOne({
        where: { id },
        relations: ['kit'],
      });

      if (!calc) {
        return res.status(404).json({ error: 'Расчёт не найден' });
      }

      const {
        name,
        channel_name,
        seller_price,
        start_price,
        seller_discount,
        marketplace_price,
        cost_type,
        tax_rate,
        variable_blocks,
      } = req.body;

      // Если изменился cost_type, обновляем snapshot
      const effectiveCostType = cost_type ?? calc.cost_type;
      let costPrice = Number(calc.cost_price);

      if (cost_type && cost_type !== calc.cost_type) {
        const kit = await kitRepository.findOne({ where: { id: calc.kit_id } });
        if (kit) {
          costPrice = effectiveCostType === 'estimated'
            ? Number(kit.estimated_cost || 0)
            : Number(kit.total_cost || 0);
        }
      }

      const effectiveSellerPrice = seller_price !== undefined ? Number(seller_price) : Number(calc.seller_price);
      const effectiveTaxRate = tax_rate !== undefined ? Number(tax_rate) : Number(calc.tax_rate);
      const effectiveBlocks = variable_blocks !== undefined ? variable_blocks : calc.variable_blocks;

      const results = calculateResults(
        effectiveSellerPrice,
        costPrice,
        effectiveTaxRate,
        effectiveBlocks
      );

      await calcRepository.update(id, {
        ...(name !== undefined && { name }),
        ...(channel_name !== undefined && { channel_name }),
        ...(seller_price !== undefined && { seller_price }),
        ...(start_price !== undefined && { start_price: start_price ?? null }),
        ...(seller_discount !== undefined && { seller_discount: seller_discount ?? null }),
        ...(marketplace_price !== undefined && { marketplace_price: marketplace_price ?? null }),
        ...(cost_type !== undefined && { cost_type }),
        ...(tax_rate !== undefined && { tax_rate }),
        ...(variable_blocks !== undefined && { variable_blocks }),
        cost_price: costPrice,
        ...results,
      });

      const updated = await calcRepository.findOne({
        where: { id },
        relations: ['kit'],
      });

      res.json(updated);
    } catch (error) {
      console.error('Ошибка при обновлении расчёта:', error);
      res.status(500).json({ error: 'Ошибка при обновлении расчёта' });
    }
  },

  // Клонировать расчёт (сохранить как новый)
  async clone(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const original = await calcRepository.findOne({ where: { id } });
      if (!original) {
        return res.status(404).json({ error: 'Расчёт не найден' });
      }

      const cloned = calcRepository.create({
        kit_id: original.kit_id,
        name: name || `${original.name} (копия)`,
        channel_name: original.channel_name,
        seller_price: original.seller_price,
        start_price: original.start_price,
        seller_discount: original.seller_discount,
        marketplace_price: original.marketplace_price,
        cost_type: original.cost_type,
        tax_rate: original.tax_rate,
        variable_blocks: original.variable_blocks,
        cost_price: original.cost_price,
        tax_amount: original.tax_amount,
        total_expenses: original.total_expenses,
        profit: original.profit,
        margin: original.margin,
      });

      const saved = await calcRepository.save(cloned);
      const full = await calcRepository.findOne({
        where: { id: saved.id },
        relations: ['kit'],
      });

      res.status(201).json(full);
    } catch (error) {
      console.error('Ошибка при клонировании расчёта:', error);
      res.status(500).json({ error: 'Ошибка при клонировании расчёта' });
    }
  },

  // Удалить расчёт
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await calcRepository.delete(id);

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Расчёт не найден' });
      }

      res.json({ message: 'Расчёт удалён' });
    } catch (error) {
      console.error('Ошибка при удалении расчёта:', error);
      res.status(500).json({ error: 'Ошибка при удалении расчёта' });
    }
  },

  // Пакетное сохранение всех каналов одного расчёта (группы)
  async batchSave(req: Request, res: Response) {
    try {
      const {
        kit_id,
        name,
        group_id: existingGroupId,
        channels,
      } = req.body as {
        kit_id: string;
        name: string;
        group_id?: string;
        channels: Array<{
          channel_name: string;
          seller_price: number;
          start_price?: number;
          seller_discount?: number;
          marketplace_price?: number;
          cost_type: 'estimated' | 'actual';
          tax_rate: number;
          variable_blocks: VariableBlock[];
        }>;
      };

      if (!kit_id || !name || !channels || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ error: 'Укажите kit_id, name и channels (непустой массив)' });
      }

      const kit = await kitRepository.findOne({ where: { id: kit_id } });
      if (!kit) {
        return res.status(404).json({ error: 'Набор не найден' });
      }

      // Генерируем новый group_id или используем существующий
      const groupId: string = existingGroupId || crypto.randomUUID();

      // Удаляем старые строки этой группы (при обновлении)
      if (existingGroupId) {
        await calcRepository
          .createQueryBuilder()
          .delete()
          .where('group_id = :groupId', { groupId: existingGroupId })
          .execute();
      }

      // Сохраняем каждый канал как отдельную строку с одинаковым group_id
      const saved: UnitEconomicsCalculation[] = [];
      for (const ch of channels) {
        const costType = ch.cost_type || 'estimated';
        const costPrice = costType === 'estimated'
          ? Number(kit.estimated_cost || 0)
          : Number(kit.total_cost || 0);

        const results = calculateResults(
          Number(ch.seller_price || 0),
          costPrice,
          Number(ch.tax_rate || 0),
          ch.variable_blocks || []
        );

        const calcData: DeepPartial<UnitEconomicsCalculation> = {
          kit_id,
          name,
          group_id: groupId,
          channel_name: ch.channel_name,
          seller_price: ch.seller_price || 0,
          ...(ch.start_price !== undefined && { start_price: ch.start_price }),
          ...(ch.seller_discount !== undefined && { seller_discount: ch.seller_discount }),
          ...(ch.marketplace_price !== undefined && { marketplace_price: ch.marketplace_price }),
          cost_type: costType,
          tax_rate: ch.tax_rate || 0,
          variable_blocks: ch.variable_blocks || [],
          cost_price: costPrice,
          ...results,
        };
        const calc = calcRepository.create(calcData);

        const row = await calcRepository.save(calc) as UnitEconomicsCalculation;
        saved.push(row);
      }

      res.status(201).json({ group_id: groupId, name, calculations: saved });
    } catch (error) {
      console.error('Ошибка при пакетном сохранении расчётов:', error);
      res.status(500).json({ error: 'Ошибка при пакетном сохранении расчётов' });
    }
  },

  // Получить список групп для артикула
  async getGroups(req: Request, res: Response) {
    try {
      const { kit_id } = req.query;

      if (!kit_id) {
        return res.status(400).json({ error: 'Укажите kit_id' });
      }

      // Получаем все расчёты с group_id для этого артикула
      const allCalcs = await calcRepository.find({
        where: { kit_id: kit_id as string },
        order: { updated_at: 'DESC' },
      });

      // Группируем по group_id
      const groupMap = new Map<string, UnitEconomicsCalculation[]>();

      for (const calc of allCalcs) {
        if (!calc.group_id) continue;
        const existing = groupMap.get(calc.group_id) || [];
        existing.push(calc);
        groupMap.set(calc.group_id, existing);
      }

      // Формируем ответ
      const groups = Array.from(groupMap.entries()).map(([gid, calcs]) => {
        // Берём updated_at самой свежей строки
        const latestUpdated = calcs.reduce((latest, c) =>
          new Date(c.updated_at) > new Date(latest) ? c.updated_at.toISOString() : latest,
          calcs[0].updated_at.toISOString()
        );

        return {
          group_id: gid,
          name: calcs[0].name,
          channel_count: calcs.length,
          updated_at: latestUpdated,
          channels: calcs.map(c => ({
            channel_name: c.channel_name,
            profit: Number(c.profit),
            margin: Number(c.margin),
          })),
        };
      });

      // Сортируем по дате (свежие первые)
      groups.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      res.json(groups);
    } catch (error) {
      console.error('Ошибка при получении групп расчётов:', error);
      res.status(500).json({ error: 'Ошибка при получении групп расчётов' });
    }
  },

  // Удалить всю группу расчётов
  async deleteGroup(req: Request, res: Response) {
    try {
      const { group_id } = req.params;

      const result = await calcRepository
        .createQueryBuilder()
        .delete()
        .where('group_id = :group_id', { group_id })
        .execute();

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Группа не найдена' });
      }

      res.json({ message: 'Группа расчётов удалена' });
    } catch (error) {
      console.error('Ошибка при удалении группы расчётов:', error);
      res.status(500).json({ error: 'Ошибка при удалении группы расчётов' });
    }
  },
};
