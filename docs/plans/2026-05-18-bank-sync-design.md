# Авто-выгрузка из банков — Design

**Date:** 2026-05-18
**Scope:** Phase 1 — авто-синхронизация транзакций из **Точки** через JWT API. Phase 2 (отдельным дизайном позже) — синхронизация **Озон-Банка** через IMAP-парсинг ежедневной выписки.

## Goal

Убрать ручной шаг «скачать Excel из ЛК банка → загрузить в XimOS». Сейчас оператор ежедневно делает это для двух банков (Точка + Озон-расчётник), это потеря 10–15 минут в день + источник опечаток (забыл скачать, скачал не за тот период, не загрузил). Автоматизация снимает человека из цепочки для Точки полностью; для Озона — частично (через email-парсинг), с возможностью ручной выгрузки как fallback.

## Non-goals (YAGNI)

- **Не реверсим 1С:ДиректБанк-протокол Озона.** Озон не предоставляет публичный API расчётника — только через 1С. Реверс-инжиниринг XML-протокола 30–60 часов работы с хрупким результатом — не стоит свеч для одного банка.
- **Не делаем настоящую 1С в облаке как middleware.** Подписка ~3000 ₽/мес + ещё один сервис в стеке.
- **Не строим pending-review UI с нуля** — переиспользуем `bankImport.controller.commit`-логику. Pending транзакции — это просто `transactions` с флагом `needs_review=true`.
- **Не добавляем webhook’и от Точки.** У них есть webhook-подписки для некоторых событий, но cron daily — достаточно для нашего объёма. Webhooks — потенциальная Phase 3 если нужна near-realtime синхронизация.
- **Не строим отдельный scheduler-сервис.** `node-cron` в основном Express-процессе — простой и достаточный.

## Architecture

### Существующая инфраструктура (без изменений)

- `BankAccount`, `Counterparty`, `Category`, `Transaction`, `BankImport`, `ImportRule` entities
- `bankImport.controller.ts:commit` — основной import pipeline: дедупликация контрагентов по ИНН, авто-категоризация через `ImportRule`, bulk-insert транзакций
- Parsers `tochka.parser.ts`, `ozon.parser.ts` для Excel — **остаются** как fallback для ручной выгрузки
- Frontend `Cashflow.tsx`, `Marketplace.tsx`

### Новые компоненты

```
┌──────────────────────────────────────────────────────────────────┐
│ node-cron 04:00 UTC (07:00 MSK) — daily                         │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
                ┌──────────────────────────────┐
                │ BankSyncService.runAll()     │
                └──────────────────────────────┘
                               ▼
              For each bank_sync_config WHERE enabled = true
                               ▼
                ┌──────────────────────────────┐
                │ Decrypt credentials (AES)    │
                └──────────────┬───────────────┘
                               ▼
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   [provider = 'tochka']           [provider = 'ozon_email'] (Phase 2)
   TochkaApiClient.fetchStatement   ImapClient.fetchAttachments
              │                                 │
              ▼                                 ▼
         NormalizedRow[]                  parseOzon(buffer)
              │                                 │
              └────────────┬────────────────────┘
                           ▼
            ┌──────────────────────────────┐
            │ bankImportService.commit     │  (extracted from controller)
            │ - dedupe by external_id      │
            │ - resolve counterparties     │
            │ - apply ImportRule[]         │
            │ - insert transactions        │
            │ - flag needs_review if no    │
            │   ImportRule match           │
            └──────────────────────────────┘
                           ▼
            ┌──────────────────────────────┐
            │ bank_sync_log entry          │
            └──────────────────────────────┘
                           ▼
            ┌──────────────────────────────┐
            │ Update last_sync_at,         │
            │ last_period_end on success   │
            └──────────────────────────────┘
```

### Сущности БД

**`bank_sync_config`** (новая таблица):
```sql
CREATE TABLE bank_sync_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id       uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  provider              varchar(40) NOT NULL,        -- 'tochka' | 'ozon_email' (Phase 2)
  enabled               boolean NOT NULL DEFAULT true,
  credentials_encrypted text,                          -- AES-256-GCM encrypted JSON
  last_sync_at          timestamptz,
  last_period_end       date,                          -- last day successfully synced
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, provider)
);
```

**`bank_sync_log`** (новая таблица):
```sql
CREATE TABLE bank_sync_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_sync_config_id   uuid NOT NULL REFERENCES bank_sync_config(id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  status                varchar(20) NOT NULL,        -- 'running' | 'success' | 'partial' | 'failed'
  period_start          date,
  period_end            date,
  rows_fetched          integer NOT NULL DEFAULT 0,
  rows_imported         integer NOT NULL DEFAULT 0,
  rows_skipped_dup      integer NOT NULL DEFAULT 0,
  rows_pending_review   integer NOT NULL DEFAULT 0,
  error_message         text
);
CREATE INDEX idx_bank_sync_log_config_started ON bank_sync_log (bank_sync_config_id, started_at DESC);
```

**`transactions`** (расширение существующей):
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions (needs_review) WHERE needs_review = true;
```

### Credentials encryption

- Симметричное **AES-256-GCM**. Node.js `crypto` (нативный).
- Master key: env var `BANK_SYNC_SECRET_KEY` на Railway. 32 байта (256 бит), base64-encoded.
- На каждую запись свой IV (96 бит, рандомный). IV + ciphertext + auth-tag сериализуются в одну base64-строку для хранения.
- Helper `crypto-util.ts` с функциями `encryptJson(value, masterKey)` / `decryptJson(blob, masterKey)`.

Преимущество перед env-var подходом: один аккаунт = одна запись, можно иметь несколько разных Точка-токенов без редеплоя, ротация через UI.

### Точка-клиент (`tochka.api.ts`)

```typescript
interface TochkaCredentials {
  token: string         // JWT bearer, выпущен Точкой, бессрочный
  client_id: string     // идентификатор интеграции
  customer_code?: string // если у пользователя несколько customer'ов; для нашего MVP — один
}

class TochkaApiClient {
  constructor(private creds: TochkaCredentials) {}

  // Список счетов клиента
  async listAccounts(): Promise<TochkaAccount[]>

  // Выписка по счёту за период
  async fetchStatement(accountCode: string, from: string, to: string): Promise<TochkaTransaction[]>
}

// Преобразует TochkaTransaction в NormalizedRow (тот же тип, что выдаёт parseTochka из Excel)
function tochkaApiToNormalizedRow(tx: TochkaTransaction): NormalizedRow
```

API endpoints (по доке Точки Open API 2.0):
- `GET /uapi/open-banking/v1.0/accounts/{customerCode}` — список счетов
- `GET /uapi/open-banking/v1.0/accounts/{customerCode}/{accountCode}/statement?dateFrom=&dateTo=` — выписка

Заголовки: `Authorization: Bearer <token>` + `client-id: <client_id>`. `dateFrom`/`dateTo` в формате `YYYY-MM-DD`.

Mapping `TochkaTransaction → NormalizedRow`:
- `transactionId` → `external_id`
- `operationDate` → `date`
- `direction == 'Credit' ? 'income' : 'expense'` → `type`
- `amount` (abs) → `amount`
- `counterparty.name` → `counterparty_name`
- `counterparty.inn` → `counterparty_inn`
- `paymentPurpose` → `description`

Дедупликация по `external_id` (`transactionId` от Точки) — у каждой транзакции уникальный ID, повторная синхронизация безопасна.

### Cron scheduler (`bank-sync.scheduler.ts`)

```typescript
import cron from 'node-cron'

// 07:00 MSK = 04:00 UTC, banking-day data settles by then
cron.schedule('0 4 * * *', async () => {
  await bankSyncService.runAll()
})

// Manual trigger endpoint also exposed for ops/testing
```

Запуск из `server.ts` при старте процесса. Если Express рестартует во время cron — следующий запуск через 24ч подберёт пропущенный период (`last_period_end` обновляется только при `status='success'`).

### Сервисный слой

**`bank-sync.service.ts`:**
```typescript
class BankSyncService {
  async runAll(): Promise<void>
  async runOne(configId: string): Promise<BankSyncLog>
  private async runTochka(config, log): Promise<void>
  private async runOzonEmail(config, log): Promise<void>  // Phase 2
}
```

Внутри `runOne`:
1. Создать `bank_sync_log` со `status='running'`
2. Расшифровать `credentials_encrypted`
3. Switch по `provider`: вызвать соответствующий fetcher
4. Привести к `NormalizedRow[]`
5. Прогнать через `bankImportService.commitNormalized(rows, bank_account_id, source='api_sync')` — extracted из существующего `bankImport.controller.commit`
6. Обновить `bank_sync_log` (`status`, `rows_*`, `finished_at`)
7. На success: обновить `bank_sync_config.last_sync_at` + `last_period_end`

**`bankImportService.commitNormalized`** — extracted shared logic, чтобы и контроллер, и cron вызывали один и тот же путь импорта. Контроллер `bankImport.controller.commit` рефакторится: вытаскиваем тело в `service.commitNormalized`, контроллер становится тонкой обвязкой (HTTP-парсинг → service → response).

### Initial backfill

При создании конфига через `POST /api/bank-sync/configs`:
- Сохраняем creds
- Запускаем **немедленный** `runOne` с `from = today - 30 days`, `to = today`
- Это даёт оператору видимость «всё подключилось, вижу свои данные» сразу

После первого backfill `last_period_end` = today, дальше cron делает дельта-pulls.

### UI

**Новая секция на `/cashflow`:**

```
┌─ Источники данных ─────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────┐                            │
│  │ 🏦 Точка     │  │ 🏦 Озон-расчётник │                            │
│  │ ✅ синк ОК   │  │ ⚠️ не настроен   │                            │
│  │ 18.05 07:00  │  │                  │                            │
│  │ 5 операций   │  │ Загружай файлы   │                            │
│  │ [Настроить→] │  │ вручную →        │                            │
│  └──────────────┘  └──────────────────┘                            │
│                                                                     │
│  Требуют категоризации: 12  [Открыть →]                            │
└─────────────────────────────────────────────────────────────────────┘
```

- Карточка банка показывает: provider, статус последней синхронизации, время, число добавленных строк, число pending-review
- Клик «Настроить» → модалка с полями `token` + `client_id`, кнопка «Сохранить и синхронизировать»
- «Загружай файлы вручную» для Озон-расчётника → ссылка на текущий manual-upload UI
- «Требуют категоризации: N» → отдельная таблица с pending-review транзакциями + кнопка «Создать ImportRule из этого паттерна» (как в Excel-импорте)

### Endpoint surface

```
GET    /api/bank-sync/configs              — список (без расшифровки creds)
POST   /api/bank-sync/configs              — создать + initial backfill
PUT    /api/bank-sync/configs/:id          — обновить (включая ротацию creds)
DELETE /api/bank-sync/configs/:id          — удалить (cascade на logs)
POST   /api/bank-sync/configs/:id/run      — ручной триггер (для тестов и retry)
GET    /api/bank-sync/logs?config_id=...   — лог попыток
```

Все эндпоинты под `authMiddleware` (как остальные `/api/*`).

## Error handling

| Кейс | Действие |
|---|---|
| Точка API 401 (токен истёк / отозван) | Log + `bank_sync_log.error_message`. UI: красный статус + «обнови токен в настройках». Cron больше не пытается до ротации. |
| Точка API 5xx | Retry 3 раза с exp backoff (1s, 5s, 30s). Если не помогло — log как `failed`. Следующий cron-tick попробует снова. |
| Network timeout | 3 retry, потом `failed`. |
| Дубликат `external_id` | Skip в commit, count в `rows_skipped_dup`. |
| Нет ImportRule match | Транзакция импортируется с `needs_review=true`, count в `rows_pending_review`. |
| AES-расшифровка упала | Catastrophic — `error_message='credential decryption failed'`. Redeploy с корректным `BANK_SYNC_SECRET_KEY` восстанавливает. |
| Express рестартует во время sync | `bank_sync_log` со `status='running'` останется hanging. Следующий cron-tick пропустит конфиги где есть незавершённый running-log младше 1 часа, потом считает их «зависшими» и перезапускает. |

## Phase 2 (sketch only, отдельный design позже)

**Триггер:** Phase 1 устаканился, оператор подтвердил что Точка-sync стабильна 1+ неделю.

**Подготовка пользователя:**
1. Завести dedicated email (например `ximi4ka.banksync@gmail.com`).
2. В ЛК Озон-Банка → Уведомления → подключить «ежедневная выписка на e-mail» на этот ящик. **Эта опция должна существовать у Озон-Банка** — это must-have для Phase 2.
3. Включить IMAP-доступ к ящику (Gmail App Password / Яндекс «разрешить IMAP»).

**Если опция e-mail-выписки у Озон-Банка отсутствует** → Phase 2 = «оставляем manual upload». DirectBank-реверс не рассматриваем в обозримом будущем.

**Скетч реализации:**
- `provider='ozon_email'` в `bank_sync_config`, credentials = `{imap_host, imap_port, imap_user, imap_password, sender_filter, last_uid}`.
- Cron подключается IMAP (библиотека `imapflow`), пуллит непрочитанные emails от `sender_filter` с `.xlsx` вложением.
- Каждое вложение сохраняется в буфер → прогоняется через существующий `parseOzon(buffer)` → результат через `commitNormalized`.
- После обработки email помечается флагом (через UID, чтобы не обработать повторно), либо складывается в отдельную папку.

## Testing / smoke

**Phase 1 smoke (manual on prod после деплоя):**

1. **Создание конфига.** В UI `/cashflow` → «Подключить Точку», вставляешь `token` + `client_id`, нажимаешь «Сохранить и синхронизировать».
2. **Initial backfill.** Через ~30 сек видишь «5 операций добавлено». В `transactions` появились записи за последние 30 дней.
3. **Дедупликация.** Запускаешь sync второй раз (кнопкой) — `rows_skipped_dup` равно числу транзакций, `rows_imported = 0`.
4. **Pending review.** Если есть транзакции без ImportRule-match — они с `needs_review=true`. Виджет «Требуют категоризации: N» виден.
5. **Создание правила.** В pending-review таблице помечаешь транзакцию + чекбокс «Создать правило» → следующий sync эту же транзакцию категоризует автоматически.
6. **Ротация токена.** Меняешь `token` через UI → следующий sync использует новый.
7. **Cron daily.** На след день в 07:00 MSK видишь новую запись в `bank_sync_log` с `period_start = вчера`, `period_end = сегодня`.
8. **Error handling.** Подменяешь token на невалидный → `bank_sync_log.status='failed'`, UI показывает красный статус.

**Автотестов не пишем** (project posture — нет test-runner’а, smoke на проде).

## Migration / rollback

- Новые таблицы additive, не ломают существующие.
- Новая колонка `transactions.needs_review` с дефолтом `false` — все существующие транзакции получают `false`, никаких side-effects.
- Откат: можно отключить cron (env flag `BANK_SYNC_ENABLED=false`) без drop таблиц. Полный откат — миграция-DROP, но данные в `bank_sync_log` могут быть полезны для post-mortem.

## Open questions / decisions deferred

- **Несколько customer-кодов у одного Точка-аккаунта.** Сейчас design предполагает один customer code на конфиг. Если у юзера несколько — нужно либо несколько конфигов, либо расширить схему. Решим если возникнет.
- **Алерты на Telegram при failure.** Сейчас алерт = UI banner. Можно расширить на Telegram-уведомление через существующий `Telegram-publisher` — но это Phase 3.
- **Webhook от Точки** (вместо daily cron). Если поток операций станет большой — переходим на webhook-уведомления Точки + immediate sync. Сейчас daily cron достаточно.
