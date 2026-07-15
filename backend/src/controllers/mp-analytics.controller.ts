import { Request, Response } from 'express';
import { syncWbFunnel, dailyRows, summaryByProduct, importFunnelRows, adReport, importAdRows, adsDetail, getPromoPlan, upsertPromoPlan, agentDigest } from '../services/mp-analytics/mp-analytics.service';
import { autoSyncWbAds, syncAdsFromWbStats } from '../services/mp-analytics/wb-ad-sync.service';
import { parseFunnelSheet, parseAdSheet } from '../services/mp-analytics/upload-parse.service';
import { syncWbStocks } from '../services/mp-analytics/wb-stock-sync.service';
import { wbApiService } from '../services/wb-api.service';
import { AppDataSource } from '../config/database';

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const NUM_FIELDS = [
  'views', 'cart', 'orders_count', 'orders_sum', 'buyouts_count', 'buyouts_sum',
  'cancels_count', 'returns_count', 'cart_conv', 'order_conv', 'buyout_percent',
  'avg_price', 'stock_end', 'share_pct', 'orders_sum_prev', 'orders_sum_delta',
  'spend', 'clicks', 'impressions', 'carts_ad', 'orders_ad', 'orders_sum_ad',
  'drr_orders', 'drr_buyouts', 'cpc', 'cost_cart', 'cost_order',
];
const mapNums = (r: any) => {
  const out = { ...r };
  for (const f of NUM_FIELDS) if (f in out) out[f] = num(out[f]);
  return out;
};

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const rangeFromQuery = (req: Request) => {
  const from = req.query.from;
  const to = req.query.to;
  if (isDate(from) && isDate(to)) return { from, to };
  return { days: Number((req.query.days as string) || '30') };
};

export const mpAnalyticsController = {
  /** Дневная таймсерия воронки/продаж. Период: days ИЛИ from&to (YYYY-MM-DD). */
  async daily(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await dailyRows(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.daily]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки дневной аналитики' });
    }
  },

  /** Итоги по продуктам + доли + сравнение с прошлым периодом. */
  async summary(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await summaryByProduct(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.summary]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки сводки' });
    }
  },

  /** Отчёт по рекламе по дням (ДРР, CPC, стоимость корзины/заказа). */
  async ads(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json((await adReport(platform, rangeFromQuery(req))).map(mapNums));
    } catch (e: any) {
      console.error('[mp-analytics.ads]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки отчёта по рекламе' });
    }
  },

  /** План продвижения на месяц по артикулам (+ маржа из юнитки). */
  async plan(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const rows = await getPromoPlan(platform, month);
      res.json(rows.map((r: any) => ({
        ...r,
        orders_sum: num(r.orders_sum), drrz: num(r.drrz), margin: num(r.margin),
      })));
    } catch (e: any) {
      console.error('[mp-analytics.plan]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки плана' });
    }
  },

  /** Сохранить план по артикулу. */
  async planSave(req: Request, res: Response) {
    try {
      const { platform = 'wb', sku, month, orders_sum, drrz } = req.body as any;
      if (!sku || !month) return res.status(400).json({ error: 'sku и month обязательны' });
      await upsertPromoPlan(platform, String(sku), String(month),
        orders_sum == null ? null : Number(orders_sum), drrz == null ? null : Number(drrz));
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[mp-analytics.planSave]', e?.message || e);
      res.status(500).json({ error: 'Ошибка сохранения плана' });
    }
  },

  /** Детальная реклама по источникам (для «Оцифровки продвижения»). */
  async adsDetail(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      const rows = await adsDetail(platform, rangeFromQuery(req));
      res.json(
        rows.map((r: any) => ({
          ...r,
          impressions: num(r.impressions), clicks: num(r.clicks), spend: num(r.spend),
          carts: num(r.carts), orders: num(r.orders), orders_sum: num(r.orders_sum),
        })),
      );
    } catch (e: any) {
      console.error('[mp-analytics.adsDetail]', e?.message || e);
      res.status(500).json({ error: 'Ошибка загрузки детализации рекламы' });
    }
  },

  /** Импорт дневной рекламы по источникам (au/apk/cpc) из РК-выгрузок. */
  async adImport(req: Request, res: Response) {
    try {
      const { platform, rows } = req.body as { platform?: 'wb' | 'ozon'; rows?: any[] };
      if ((platform !== 'wb' && platform !== 'ozon') || !Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'Нужны platform (wb|ozon) и непустой rows[]' });
      }
      res.json({ ok: true, upserted: await importAdRows(platform, rows) });
    } catch (e: any) {
      console.error('[mp-analytics.adImport]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка импорта рекламы') });
    }
  },

  /** Импорт готовых строк из отчёта (бэкофилл из xlsx). */
  async import(req: Request, res: Response) {
    try {
      const { platform, rows } = req.body as {
        platform?: 'wb' | 'ozon';
        rows?: Array<{ date: string; sku: string } & Record<string, number | null>>;
      };
      if ((platform !== 'wb' && platform !== 'ozon') || !Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'Нужны platform (wb|ozon) и непустой rows[]' });
      }
      const upserted = await importFunnelRows(platform, rows);
      res.json({ ok: true, upserted });
    } catch (e: any) {
      console.error('[mp-analytics.import]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка импорта') });
    }
  },

  /** Ручной синк WB-воронки (fire-and-forget: nm-report ~3 req/min, может >30с). */
  async sync(req: Request, res: Response) {
    const days = Number((req.body?.days as number) || 30);
    syncWbFunnel(days)
      .then((r) => console.log('[mp-analytics] manual sync done:', r))
      .catch((e) => console.error('[mp-analytics] manual sync failed:', e?.message || e));
    res.json({ ok: true, started: true });
  },

  /**
   * Автосинк рекламы: fetch advert-api /fullstats → wb_ad_stats (при лимите WB — пропуск),
   * затем маппер wb_ad_stats → mp_ad_daily. `?mapOnly=1` — только маппер (без обращения к WB).
   */
  async adSync(req: Request, res: Response) {
    const days = Number((req.body?.days as number) || 30);
    const mapOnly = req.body?.mapOnly === true || req.query?.mapOnly === '1';
    try {
      if (mapOnly) {
        const r = await syncAdsFromWbStats(days + 15);
        return res.json({ ok: true, mapOnly: true, ...r });
      }
      autoSyncWbAds(days)
        .then((r) => console.log('[mp-analytics] manual ad-sync done:', r))
        .catch((e) => console.error('[mp-analytics] manual ad-sync failed:', e?.message || e));
      res.json({ ok: true, started: true });
    } catch (e: any) {
      console.error('[mp-analytics.adSync]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка автосинка рекламы') });
    }
  },

  /**
   * Диагностика WB advert-api (read-only): синхронно дёргает getCampaigns и,
   * если получилось, короткий fullstats за 2 дня — чтобы увидеть реальный ответ/ошибку
   * WB (лимит 429 vs пусто vs 401), не полагаясь на логи Railway. Ничего не пишет.
   */
  async wbAdDiag(req: Request, res: Response) {
    // ?full=1 — синхронно прогнать весь autoSyncWbAds(30) и вернуть результат/ошибку
    if (req.query.full === '1') {
      try {
        const r = await autoSyncWbAds(30);
        return res.json({ full: true, ok: true, ...r });
      } catch (e: any) {
        return res.json({ full: true, ok: false, error: String(e?.stack || e?.message || e) });
      }
    }
    const out: any = {
      token_present: wbApiService.hasToken(),
      cooldown_s: Math.ceil(wbApiService.cooldownRemainingMs() / 1000),
      campaigns: null, fullstats: null,
    };
    const t0 = Date.now();
    try {
      const campaigns = await wbApiService.getCampaigns();
      out.campaigns = {
        ok: true, count: campaigns.length,
        by_type: campaigns.reduce((m: any, c) => { m[c.type] = (m[c.type] || 0) + 1; return m; }, {}),
      };
      if (campaigns.length) {
        const end = new Date().toISOString().slice(0, 10);
        const begin = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
        try {
          const stats = await wbApiService.getFullStats(campaigns.slice(0, 50).map((c) => c.advertId), begin, end);
          out.fullstats = { ok: true, items: stats.length, begin, end };
        } catch (e: any) {
          out.fullstats = { ok: false, error: String(e?.message || e) };
        }
      }
    } catch (e: any) {
      out.campaigns = { ok: false, error: String(e?.message || e) };
    }
    out.ms = Date.now() - t0;
    res.json(out);
  },

  /**
   * Ручная заливка дневных показателей из файла (фоллбэк автосинка).
   * multipart: file (xlsx/csv) + platform (wb|ozon) + kind (funnel|ads).
   * ?dryRun=1 — только распарсить и показать предпросмотр (без записи).
   */
  async upload(req: Request, res: Response) {
    try {
      const file = (req as any).file as { buffer: Buffer } | undefined;
      if (!file?.buffer) return res.status(400).json({ error: 'Файл не загружен' });
      const platform = (req.body?.platform as string) === 'ozon' ? 'ozon' : 'wb';
      const kind = (req.body?.kind as string) === 'ads' ? 'ads' : 'funnel';
      const dryRun = req.query?.dryRun === '1' || req.body?.dryRun === '1' || req.body?.dryRun === true;

      const parsed = kind === 'ads' ? parseAdSheet(file.buffer) : parseFunnelSheet(file.buffer);
      const preview = {
        platform, kind,
        headers: parsed.headers,
        field_map: parsed.fieldMap,
        unmatched_headers: parsed.unmatched,
        rows_parsed: parsed.rows.length,
        rows_skipped: parsed.skipped,
        sample: parsed.rows.slice(0, 8),
      };
      if (dryRun) return res.json({ ok: true, dryRun: true, ...preview });

      if (!parsed.rows.length) {
        return res.status(400).json({ error: 'Не удалось распознать ни одной строки (нет колонок Дата/SKU?)', ...preview });
      }
      const imported = kind === 'ads'
        ? await importAdRows(platform, parsed.rows)
        : await importFunnelRows(platform, parsed.rows);
      res.json({ ok: true, imported, ...preview });
    } catch (e: any) {
      console.error('[mp-analytics.upload]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка загрузки файла') });
    }
  },

  /**
   * Сводка по артикулам для агента: воронка + реклама + маржа + производные.
   * GET ?platform=wb|ozon&from&to (или days). Самоописываемый JSON.
   */
  async agentDigest(req: Request, res: Response) {
    try {
      const platform = (req.query.platform as string) || 'wb';
      res.json(await agentDigest(platform, rangeFromQuery(req)));
    } catch (e: any) {
      console.error('[mp-analytics.agentDigest]', e?.message || e);
      res.status(500).json({ error: 'Ошибка формирования сводки' });
    }
  },
/**
   * Диагностика WB nm-report (воронка, read-only): синхронно дёргает
   * getNmReportHistory по одному nmId за 3 дня — возвращает реальный ответ/ошибку.
   */
  async wbFunnelDiag(req: Request, res: Response) {
    // ?full=1 — синхронно прогнать весь syncWbFunnel(7) и вернуть результат/ошибку
    if (req.query.full === '1') {
      try {
        const r = await syncWbFunnel(7);
        return res.json({ full: true, ok: true, ...r });
      } catch (e: any) {
        return res.json({ full: true, ok: false, error: String(e?.stack || e?.message || e) });
      }
    }
    const out: any = { token_present: wbApiService.hasToken(), cooldown_s: Math.ceil(wbApiService.cooldownRemainingMs() / 1000) };
    const t0 = Date.now();
    try {
      const ids = await AppDataSource.query(`SELECT DISTINCT nm_id FROM wb_financial_stats LIMIT 3`);
      out.nm_ids = ids.map((r: any) => Number(r.nm_id));
      const end = new Date().toISOString().slice(0, 10);
      const begin = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      const items = await wbApiService.getNmReportHistory(out.nm_ids, begin, end);
      out.nm_report = {
        ok: true, items: items.length, begin, end,
        sample: items[0] ? { nmID: items[0].nmID, vendorCode: items[0].vendorCode, points: items[0].history?.length } : null,
        raw_point: items[0]?.history?.[0] ?? null, // реальные имена полей точки — для сверки маппера
      };
    } catch (e: any) {
      out.nm_report = { ok: false, error: String(e?.message || e) };
    }
    out.ms = Date.now() - t0;
    res.json(out);
  },
  /** Ручной синк остатков WB (stocks-report, ~секунды). */
  async stockSync(_req: Request, res: Response) {
    try {
      res.json({ ok: true, ...(await syncWbStocks()) });
    } catch (e: any) {
      console.error('[mp-analytics.stockSync]', e?.message || e);
      res.status(500).json({ error: String(e?.message || 'Ошибка синка остатков') });
    }
  },
};
