/**
 * Ручная заливка дневных показателей (фоллбэк, когда автосинк не сработал).
 * Парсит xlsx/csv по ИМЕНАМ колонок (толерантно — RU-лейблы WB/Ozon + канон),
 * возвращает распарсенные строки + карту сопоставления для предпросмотра.
 * Формат-агностично: что не распозналось — видно в preview, импорт не вслепую.
 */
import * as XLSX from 'xlsx';

export interface ParsedSheet<T> {
  headers: string[];
  fieldMap: Record<string, string>; // canonicalField -> matched header
  unmatched: string[]; // заголовки, которые ни к чему не привязались
  rows: T[];
  skipped: number; // строки без date/sku
}

const norm = (s: unknown): string =>
  String(s ?? '').toLowerCase().replace(/[.,%()"'`]/g, ' ').replace(/\s+/g, ' ').trim();

/** Первое совпадение заголовка с любым из алиасов (по подстроке нормализованных). */
function matchHeader(headers: string[], aliases: string[]): string | null {
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const a of aliases) {
    const na = norm(a);
    const exact = normed.find((h) => h.n === na);
    if (exact) return exact.raw;
  }
  for (const a of aliases) {
    const na = norm(a);
    const sub = normed.find((h) => h.n.includes(na));
    if (sub) return sub.raw;
  }
  return null;
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(/ /g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Нормализация даты: Excel-serial | DD.MM.YYYY | YYYY-MM-DD → YYYY-MM-DD. */
function toIsoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial (1900-based); XLSX.SSF даёт компоненты
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    return null;
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ru = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (ru) {
    const y = ru[3].length === 2 ? `20${ru[3]}` : ru[3];
    return `${y}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
  }
  return null;
}

function readSheet(buffer: Buffer): { headers: string[]; records: Record<string, unknown>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], records: [] };
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const headers = records.length ? Object.keys(records[0]) : [];
  return { headers, records };
}

// ── Словари заголовков ──────────────────────────────────────────────────────
const FUNNEL_ALIASES: Record<string, string[]> = {
  date: ['дата', 'день', 'date'],
  sku: ['sku', 'артикул wb', 'nmid', 'nm id', 'артикул', 'ozon sku', 'sku ozon', 'ozon id'],
  seller_article: ['артикул продавца', 'артикул поставщика', 'ваш артикул', 'seller article', 'vendor code'],
  product_name: ['товар', 'наименование', 'название', 'наименование товара', 'name'],
  views: ['показы', 'переходы в карточку', 'переходы', 'просмотры', 'показы всего', 'views'],
  cart: ['добавления в корзину', 'положили в корзину', 'в корзину', 'корзины', 'корзина', 'cart', 'добавления в корзину всего'],
  orders_count: ['заказано товаров', 'заказы шт', 'заказы, шт', 'заказано шт', 'заказы штук', 'заказы (шт)', 'orders', 'заказано, шт'],
  orders_sum: ['заказано на сумму', 'сумма заказов', 'заказы руб', 'заказы, руб', 'заказы (руб)', 'выручка заказов'],
  buyouts_count: ['выкуплено товаров', 'выкуплено шт', 'выкуплено, шт', 'выкупы шт', 'выкуплено'],
  buyouts_sum: ['выкуплено на сумму', 'сумма выкупов', 'выкупы руб', 'выкуплено, руб'],
  stock_end: ['остаток', 'остатки', 'сток', 'остаток на конец'],
};

const AD_ALIASES: Record<string, string[]> = {
  date: ['дата', 'день', 'date'],
  sku: ['sku', 'артикул wb', 'nmid', 'nm id', 'артикул', 'ozon sku', 'ozon id'],
  seller_article: ['артикул продавца', 'ваш артикул', 'seller article', 'vendor code'],
  source: ['источник', 'тип', 'тип кампании', 'источник трафика', 'source', 'площадка'],
  impressions: ['показы', 'impressions', 'показы всего'],
  clicks: ['клики', 'clicks', 'переходы'],
  spend: ['расход', 'затраты', 'потрачено', 'ставка', 'spend', 'cost', 'бюджет'],
  carts: ['корзины', 'в корзину', 'добавления в корзину', 'carts'],
  orders: ['заказы', 'заказано', 'заказы шт', 'orders'],
  orders_sum: ['сумма заказов', 'заказы руб', 'выручка', 'orders sum'],
};

/** Маппинг «источник» Ozon/WB → au(поиск)/apk(полки)/cpc. */
function normSource(v: unknown): string {
  const s = norm(v);
  if (!s) return 'au';
  if (/поиск|search|au\b/.test(s)) return 'au';
  if (/полк|shelf|apk|трафарет|каталог/.test(s)) return 'apk';
  if (/cpc/.test(s)) return 'cpc';
  return 'au';
}

function buildFieldMap(headers: string[], aliases: Record<string, string[]>) {
  const fieldMap: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, al] of Object.entries(aliases)) {
    const h = matchHeader(headers, al);
    if (h && !used.has(h)) { fieldMap[field] = h; used.add(h); }
  }
  const unmatched = headers.filter((h) => !used.has(h));
  return { fieldMap, unmatched };
}

export function parseFunnelSheet(buffer: Buffer): ParsedSheet<any> {
  const { headers, records } = readSheet(buffer);
  const { fieldMap, unmatched } = buildFieldMap(headers, FUNNEL_ALIASES);
  const g = (r: Record<string, unknown>, f: string) => (fieldMap[f] ? r[fieldMap[f]] : null);
  const rows: any[] = [];
  let skipped = 0;
  for (const r of records) {
    const date = toIsoDate(g(r, 'date'));
    const sku = g(r, 'sku');
    if (!date || sku == null || String(sku).trim() === '') { skipped++; continue; }
    rows.push({
      date, sku: String(sku).trim(),
      product_name: g(r, 'product_name') != null ? String(g(r, 'product_name')) : null,
      views: numOrNull(g(r, 'views')), cart: numOrNull(g(r, 'cart')),
      orders_count: numOrNull(g(r, 'orders_count')), orders_sum: numOrNull(g(r, 'orders_sum')),
      buyouts_count: numOrNull(g(r, 'buyouts_count')), buyouts_sum: numOrNull(g(r, 'buyouts_sum')),
      stock_end: numOrNull(g(r, 'stock_end')),
    });
  }
  return { headers, fieldMap, unmatched, rows, skipped };
}

export function parseAdSheet(buffer: Buffer): ParsedSheet<any> {
  const { headers, records } = readSheet(buffer);
  const { fieldMap, unmatched } = buildFieldMap(headers, AD_ALIASES);
  const g = (r: Record<string, unknown>, f: string) => (fieldMap[f] ? r[fieldMap[f]] : null);
  const rows: any[] = [];
  let skipped = 0;
  for (const r of records) {
    const date = toIsoDate(g(r, 'date'));
    const sku = g(r, 'sku');
    if (!date || sku == null || String(sku).trim() === '') { skipped++; continue; }
    rows.push({
      date, sku: String(sku).trim(), source: normSource(g(r, 'source')),
      seller_article: g(r, 'seller_article') != null ? String(g(r, 'seller_article')) : null,
      impressions: numOrNull(g(r, 'impressions')), clicks: numOrNull(g(r, 'clicks')),
      spend: numOrNull(g(r, 'spend')), carts: numOrNull(g(r, 'carts')),
      orders: numOrNull(g(r, 'orders')), orders_sum: numOrNull(g(r, 'orders_sum')),
    });
  }
  return { headers, fieldMap, unmatched, rows, skipped };
}
