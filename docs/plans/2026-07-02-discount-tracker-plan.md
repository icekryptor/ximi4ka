# Discount Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans / Workflow-оркестрация.

**Goal:** Часовой трекер СПП (WB) / соинвеста (Ozon): снапшоты витрина-vs-продавец, Telegram-алерты на просадку, мини-дашборд в ERP.

**Architecture:** node-cron в backend Railway (не GitHub Actions), TypeORM вместо supabase-js, схема БД из блюпринта дословно. WB nmIds — DISTINCT из wb_financial_stats за 90 дней. Дашборд `/marketplace/discount-tracker`.

**Design:** `docs/plans/2026-07-02-discount-tracker-design.md`
**Блюпринт (референс-код):** `docs/plans/2026-07-02-discount-tracker-blueprint.ts.txt` + `2026-07-02-discount-tracker-blueprint.sql`

**Testing note:** typecheck + живой smoke (WB API публичный) + Playwright + прод-прогон.

---

## Task 1: Миграция БД

**Create:** `backend/src/migrations/2026-07-02-discount-tracker.sql` — содержимое `docs/plans/2026-07-02-discount-tracker-blueprint.sql` ДОСЛОВНО (price_snapshots, idx, v_price_latest, v_spp_delta, alert_state).
Применить через Supabase MCP (`apply_migration`, project `jubkezbvccwvujregkfq`, name `2026_07_02_discount_tracker`). Verify: обе таблицы + обе вьюхи существуют.
Commit: `feat(discount-tracker): migration — price_snapshots, alert_state, views`

> **СТАТУС 2026-07-03: файл создан и закоммичен (9e84ee5), но миграция НЕ применена — ВНЕШНИЙ БЛОКЕР.**
> Проект `jubkezbvccwvujregkfq` в статусе INACTIVE; `restore_project` детерминированно возвращает
> `PaymentRequiredException` (неоплаченные счета организации `qmnwyrpfothyjtfhsvyt`, «icekryptor's Org», план free);
> прямое подключение к пулеру падает: `FATAL: (ENOTFOUND) tenant/user postgres.jubkezbvccwvujregkfq not found`.
> **Разблокировка (действия пользователя):** оплатить счета в Supabase Dashboard → Billing → Invoices,
> затем restore проекта. **После restore выполнить:** `apply_migration` (project `jubkezbvccwvujregkfq`,
> name `2026_07_02_discount_tracker`, SQL из `backend/src/migrations/2026-07-02-discount-tracker.sql`),
> затем DB-verify: `SELECT ... LIMIT 1` из `price_snapshots`, `alert_state`, `v_price_latest`, `v_spp_delta`
> + наличие индекса `idx_snap_sku_time` в `pg_indexes`.

## Task 2: Backend

**Create:**
- `backend/src/entities/PriceSnapshot.ts` — `@Entity('price_snapshots')`: id (bigint, `@PrimaryGeneratedColumn({type:'bigint'})` — ВНИМАНИЕ: в БД identity; использовать `@PrimaryColumn` c generated識 или просто читать/писать через query — сверить с существующими bigint-identity entities если есть; иначе insert через AppDataSource.query), captured_at, platform, sku, seller_price/shelf_price/own_discount/platform_disc/discount_pct/platform_pct (numeric → string в TypeORM! конвертить Number() при чтении), raw jsonb
- `backend/src/entities/AlertState.ts` — composite PK (platform, sku): `@PrimaryColumn()` ×2, last_pct numeric, last_alerted timestamptz
- **Зарегистрировать оба в allEntities** (`backend/src/config/database.ts`) — glob-discovery нет!
- `backend/src/services/discount-tracker/wb.prices.ts` — из блюпринта fetchWb: батчи по 100, `card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=...`, seller=price.product/100, shelf=price.total/100, platform_disc=max(seller−shelf,0)
- `backend/src/services/discount-tracker/ozon.prices.ts` — из блюпринта fetchOzon: POST `OZON_PRICES_URL` (env, дефолт `https://api-seller.ozon.ru/v5/product/info/prices`), headers Client-Id/Api-Key, body {cursor, limit:1000, filter:{visibility:'ALL'}}, cursor-пагинация; поля price/marketing_seller_price/marketing_price; без ключей → return [] с console.log('[discount-tracker] ozon keys missing, skip'); при 404 → console.error с подсказкой про v4/v5
- `backend/src/services/discount-tracker/discount-tracker.service.ts` — runOnce(): nmIds = `SELECT DISTINCT nm_id FROM wb_financial_stats WHERE date > now() - interval '90 days'`; snaps = fetchWb + fetchOzon; batch insert в price_snapshots (raw JSON.stringify); maybeAlert по каждому: читать alert_state, если last_pct − platform_pct >= ALERT_DROP_PP/100 → sendMessage(SPP_ALERT_CHAT_ID, текст из блюпринта) из `../telegram.service`; upsert alert_state. Вернуть {snapshots, alerts} счётчики
- `backend/src/services/discount-tracker/scheduler.ts` — node-cron `'0 * * * *'` по образцу bank-sync/scheduler.ts, лог `[discount-tracker] scheduler started (cron: 0 * * * *)`, запуск из server.ts рядом с bank-sync
- `backend/src/controllers/discount-tracker.controller.ts` + `routes/discount-tracker.routes.ts`:
  - `GET /latest` — `SELECT * FROM v_price_latest` + LEFT JOIN название товара из wb_financial_stats (проверить какие текст-колонки есть: sa_name/subject/brand; взять первую живую; для ozon имя = sku)
  - `GET /history?platform=&sku=&hours=48` — снапшоты за N часов asc
  - `GET /alerts` — alert_state WHERE last_alerted IS NOT NULL ORDER BY last_alerted DESC LIMIT 50
  - `POST /run` — await runOnce(), вернуть счётчики (как bank-sync run)
- Mount в server.ts: `app.use('/api/discount-tracker', authMiddleware, discountTrackerRoutes)` + импорт + старт scheduler

Typecheck. Commit: `feat(discount-tracker): backend — collector WB/Ozon, hourly cron, alerts, API`

## Task 3: Frontend

**Create:**
- `frontend/src/api/discountTracker.ts` — типы + api (latest, history, alerts, run)
- `frontend/src/pages/DiscountTracker.tsx`:
  - Заголовок «Трекер скидок» + кнопка «Запустить сейчас» (POST /run, toast с итогом)
  - Фильтр платформы (Все/WB/Ozon), таблица: платформа-бейдж, SKU+название, цена продавца, витрина, СПП/соинвест % (жирно, цвет: ≥10% зелёный, 5-10 жёлтый, <5 красный), обновлено
  - Клик по строке → раскрытие: SVG-спарклайн platform_pct за 48ч + мини-таблица последних дельт (история из /history)
  - Блок «Последние алерты» под таблицей
  - Пустое состояние: «Снапшотов ещё нет — запусти вручную или дождись часового крона»
- НЕ трогать App.tsx/Layout.tsx (Task 4)

Typecheck. Commit: `feat(discount-tracker): frontend — дашборд СПП/соинвест со спарклайнами`

## Task 4: Wiring

App.tsx: `<Route path="/marketplace/discount-tracker" element={<DiscountTracker />} />` рядом с wb-ads. Layout.tsx: секция «Маркетплейсы» → пункт «Трекер скидок» (иконка по образцу). Typecheck.
Commit: `feat(discount-tracker): route + sidebar`

## Task 5: E2E + деплой (главная сессия)

> **СТАТУС 2026-07-03: заблокирован тем же внешним блокером, что и Task 1** (Supabase-проект INACTIVE
> до оплаты счетов и restore). Прод-прогон возможен только после restore + apply_migration.

1. Локально: build backend, `POST /run` без Ozon-ключей → WB-снапшоты пишутся (живой публичный API), проверка строк в price_snapshots
2. Playwright: страница рендерит таблицу, фильтр, спарклайн, кнопка run
3. push origin + vercel-deploy; прод: POST /run → снапшоты; повторный run → дельта-вьюха работает
4. Сообщить пользователю: добавить в Railway `OZON_CLIENT_ID`, `OZON_API_KEY`, `SPP_ALERT_CHAT_ID`

## Env summary (для Railway Variables)

`OZON_CLIENT_ID`, `OZON_API_KEY` — Ozon Seller API; `SPP_ALERT_CHAT_ID` — чат алертов; `ALERT_DROP_PP` (опц., дефолт 5); `OZON_PRICES_URL` (опц., дефолт v5).
