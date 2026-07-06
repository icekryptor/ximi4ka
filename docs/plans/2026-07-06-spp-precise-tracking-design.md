# Точный СПП-трекинг + публичная ссылка — Design (2026-07-06)

## Требования
1. Опрос каждые **5 мин** (было — час).
2. Точность до **десятых** (0.1%).
3. **Почасовое среднее** СПП в таблице.
4. **Публичная ссылка** (роут в ERP) для менеджера ВБ — показывать **всё, включая цену продавца**.

## 1. Частота: расцепить дорогой seller-API от дешёвой витрины
Нельзя дёргать всё каждые 5 мин — seller-API `discounts-prices` ловит рейт-лимит
(инцидент 07:02, коммит b487323). Цена продавца меняется редко (≈раз в сутки), СПП
двигает витрина. Поэтому:
- node-cron `*/5 * * * *`.
- **Витрина** (card, curl/релей — лимитов нет) — каждые 5 мин.
- **Цена продавца** — кеш в памяти, TTL 30 мин (env `WB_SELLER_TTL_MIN`). Refresh
  с ретраем (уже есть fetchRetry); при неудаче держим прошлый кеш → 5-мин тики всегда
  имеют цену продавца, ложный 0% исключён.
- Итог: seller-API ~2 req/час, card 12 req/час.

## 2. Точность
`platform_pct` хранится долей полной точностью. Везде вывод `.toFixed(1)` → 0.1%.
Почасовая таблица и публичная страница — так же.

## 3. Почасовое среднее
`GET /api/discount-tracker/hourly?hours=24` → `avg(platform_pct)`, `avg(shelf)`,
`avg(seller)`, `count` по `(platform, sku, date_trunc('hour', captured_at))` + product_name.
Фронт: пивот час×артикул, ячейка = средняя СПП% (0.1), тултип = число замеров.

## 4. Публичная ссылка
- Backend: `GET /api/public/spp/:token` (до authMiddleware, как unit-economics).
  Токен сверяется с env `SPP_PUBLIC_TOKEN`; неверный → **403** (не 401 — иначе сработает
  auto-logout интерсептор axios). Отдаёт `{ latest[], hourly[], generated_at }`, latest
  полный (seller_price, shelf, субсидия ₽, СПП%).
- Frontend: роут `/p/spp/:token` **вне ProtectedRoute** (как PublicUnitEconomics).
  Standalone-страница: таблица «сейчас» (артикул, название, цена продавца, витрина,
  субсидия ₽, СПП%) + таблица «почасовое среднее». **bare fetch** (обход axios-интерсептора),
  автообновление раз в 5 мин, read-only.
- Токен: 32 hex в `SPP_PUBLIC_TOKEN` (Railway). Ссылка `https://erp.ximi4ka.ru/p/spp/<token>`.
  Отзыв = смена env.

## Env (Railway, добавить)
- `SPP_PUBLIC_TOKEN=<32hex>` — новый, активирует ссылку.
- `WB_SELLER_TTL_MIN=30` — опц. (дефолт 30).

## Тест
typecheck (backend+frontend); ts-node регресс кеша seller (5-мин тик без refresh берёт
кеш; refresh раз в TTL); прод-smoke public endpoint (403 без токена, 200 с токеном);
Playwright — публичная страница рендерит обе таблицы.
