import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ChannelPreset, PresetVariableBlock } from '../entities/ChannelPreset';

const presetRepository = AppDataSource.getRepository(ChannelPreset);

export const channelPresetController = {
  // Получить все пресеты каналов
  async getAll(req: Request, res: Response) {
    try {
      const presets = await presetRepository.find({
        order: { channel_name: 'ASC' },
      });

      res.json(presets);
    } catch (error) {
      console.error('Ошибка при получении пресетов каналов:', error);
      res.status(500).json({ error: 'Ошибка при получении пресетов каналов' });
    }
  },

  // Получить пресет по названию канала
  async getByChannel(req: Request, res: Response) {
    try {
      const { channelName } = req.params;
      const preset = await presetRepository.findOne({
        where: { channel_name: channelName },
      });

      if (!preset) {
        return res.status(404).json({ error: 'Пресет для данного канала не найден' });
      }

      res.json(preset);
    } catch (error) {
      console.error('Ошибка при получении пресета канала:', error);
      res.status(500).json({ error: 'Ошибка при получении пресета канала' });
    }
  },

  // Создать или обновить пресет канала
  async upsert(req: Request, res: Response) {
    try {
      const { channelName } = req.params;
      const { variable_blocks } = req.body as { variable_blocks: PresetVariableBlock[] };

      if (!variable_blocks || !Array.isArray(variable_blocks)) {
        return res.status(400).json({ error: 'Укажите variable_blocks (массив)' });
      }

      const existing = await presetRepository.findOne({
        where: { channel_name: channelName },
      });

      if (existing) {
        await presetRepository.update(existing.id, { variable_blocks });
        const updated = await presetRepository.findOne({ where: { id: existing.id } });
        return res.json(updated);
      }

      const preset = presetRepository.create({
        channel_name: channelName,
        variable_blocks,
      });

      const saved = await presetRepository.save(preset);
      res.status(201).json(saved);
    } catch (error) {
      console.error('Ошибка при сохранении пресета канала:', error);
      res.status(500).json({ error: 'Ошибка при сохранении пресета канала' });
    }
  },
};
