import { Request, Response } from 'express';
import { wbApiService } from '../services/wb-api.service';
import { saveWbApiToken, getSettingUpdatedAt, WB_API_TOKEN_KEY } from '../services/settings.service';

export const settingsController = {
  /** GET /api/settings/integrations — статус токенов (без раскрытия полного значения). */
  async integrations(_req: Request, res: Response) {
    try {
      res.json({
        wb: {
          configured: wbApiService.hasToken(),
          masked: wbApiService.getMaskedToken(),
          updated_at: await getSettingUpdatedAt(WB_API_TOKEN_KEY),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Ошибка загрузки настроек' });
    }
  },

  /** PUT /api/settings/wb-token — сохранить WB-токен (в БД + применить сразу). */
  async saveWbToken(req: Request, res: Response) {
    try {
      const { token } = req.body as { token?: unknown };
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return res.status(400).json({ error: 'Токен не может быть пустым' });
      }
      await saveWbApiToken(token);
      res.json({ success: true, configured: true, masked: wbApiService.getMaskedToken() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Ошибка сохранения токена' });
    }
  },
};
