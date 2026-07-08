import { AppDataSource } from '../config/database';
import { AppSetting } from '../entities/AppSetting';
import { wbApiService } from './wb-api.service';

/**
 * Глобальные настройки в таблице app_settings (key → jsonb).
 * WB-токен хранится здесь (ключ wb_api_token) и переживает редеплои —
 * один токен на все WB-фичи (Реклама, Финансы, трекер СПП), редактируется
 * в «Настройки → Интеграции».
 */

const repo = () => AppDataSource.getRepository(AppSetting);
export const WB_API_TOKEN_KEY = 'wb_api_token';
export const OZON_API_CREDS_KEY = 'ozon_api_creds';

/** Креды Ozon: Performance API (реклама, OAuth) + Seller API (аналитика/воронка). */
export interface OzonApiCreds {
  perf_client_id?: string;
  perf_client_secret?: string;
  seller_client_id?: string;
  seller_api_key?: string;
}

const maskValue = (v?: string): string | null => {
  if (!v) return null;
  const s = v.trim();
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
};

export async function getOzonCreds(): Promise<OzonApiCreds> {
  return (await getSetting<OzonApiCreds>(OZON_API_CREDS_KEY)) || {};
}

/** Сохранить креды Ozon: только непустые поля переписываются (частичное обновление). */
export async function saveOzonCreds(patch: OzonApiCreds): Promise<void> {
  const cur = await getOzonCreds();
  const next: OzonApiCreds = { ...cur };
  for (const k of ['perf_client_id', 'perf_client_secret', 'seller_client_id', 'seller_api_key'] as const) {
    const v = patch[k];
    if (typeof v === 'string' && v.trim()) next[k] = v.trim();
  }
  await setSetting(OZON_API_CREDS_KEY, next);
}

/** Статус кредов Ozon для UI (маскированный, без раскрытия секретов). */
export async function getOzonCredsStatus(): Promise<{
  perf_configured: boolean; seller_configured: boolean;
  perf_client_id_masked: string | null; seller_client_id_masked: string | null;
  updated_at: Date | null;
}> {
  const c = await getOzonCreds();
  return {
    perf_configured: !!(c.perf_client_id && c.perf_client_secret),
    seller_configured: !!(c.seller_client_id && c.seller_api_key),
    perf_client_id_masked: maskValue(c.perf_client_id),
    seller_client_id_masked: maskValue(c.seller_client_id),
    updated_at: await getSettingUpdatedAt(OZON_API_CREDS_KEY),
  };
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await repo().findOne({ where: { key } });
  return row ? (row.value as T) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await repo().save({ key, value });
}

/** Дата последнего изменения настройки (для UI). */
export async function getSettingUpdatedAt(key: string): Promise<Date | null> {
  const row = await repo().findOne({ where: { key } });
  return row?.updated_at ?? null;
}

/** Сохранить WB-токен: в БД + применить к работающему сервису + process.env. */
export async function saveWbApiToken(token: string): Promise<void> {
  const t = token.trim();
  await setSetting(WB_API_TOKEN_KEY, t);
  wbApiService.setToken(t); // память + process.env (его читает трекер СПП)
}

/**
 * На старте: подтянуть WB-токен из БД в работающий сервис.
 * Приоритет у БД (там отредактированное значение). Если в БД пусто, а в env
 * токен есть (старый способ) — засеять БД из env, чтобы дальше источник один.
 */
export async function loadWbApiTokenFromDb(): Promise<boolean> {
  try {
    const token = await getSetting<string>(WB_API_TOKEN_KEY);
    if (typeof token === 'string' && token.trim()) {
      wbApiService.setToken(token.trim());
      console.log('[settings] WB-токен загружен из БД');
      return true;
    }
    if (wbApiService.hasToken() && process.env.WB_API_TOKEN) {
      await setSetting(WB_API_TOKEN_KEY, process.env.WB_API_TOKEN);
      console.log('[settings] WB-токен засеян в БД из env');
    }
    return false;
  } catch (e: any) {
    console.error('[settings] loadWbApiTokenFromDb failed:', e?.message || e);
    return false;
  }
}
