import { Request, Response } from 'express';
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
  // Получить все расчёты (фильтр по kit_id)
  async getAll(req: Request, res: Response) {
    try {
      const { kit_id } = req.query;
      const where: any = {};
      if (kit_id) where.kit_id = kit_id;

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
};
