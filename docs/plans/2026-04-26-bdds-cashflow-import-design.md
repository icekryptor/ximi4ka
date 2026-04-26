# БДДС + импорт банковских выписок — Design Doc

**Date:** 2026-04-26
**Status:** Approved (brainstorming complete)
**Owner:** icekryptor

## Goal

Превратить ручной учёт в `Transactions` в полноценную финансовую подсистему: автоматический импорт выписок Точки и Озона, обучаемое сопоставление контрагентов и категорий, БДДС-отчёт с разбивкой по разделам МСФО и фильтрами по разрезам.

## Scope

### Phase 1 (MVP, ~9 дней) — текущая итерация
1. Импорт Excel-выписок Точка/Озон + дедуп переводов между ними
2. Превью с подтверждением + обучение правил
3. БДДС-факт (ОДДС) — таблица «категории × месяцы», разбивка операционная/инвестиционная/финансовая
4. Переключатель месяц/неделя
5. Разрезы: фильтры по банку, контрагенту, проекту, департаменту

### Phase 2 (Standard, ~7 дней) — следующая итерация
6. План (ввод плановых цифр по категориям) + отклонения «план vs факт»
7. Повторяющиеся платежи (отдельный модуль `RecurringPayments`):
   - Шаблоны: аренда, зарплаты, подписки → автогенерация плановых
   - Агрегированная «финансовая нагрузка на месяц»
   - Редактирование размера каждого экземпляра отдельно (например, аренда обычно 80k, в декабре 100k)

### Phase 3 — отложено
8. Платёжный календарь (визуализация ожидаемых платежей по дням)

## Architecture

**Подход:** расширение существующей подсистемы (`transactions`, `categories`, `counterparties`), без параллельной финансовой структуры. Существующие транзакции тоже попадают в БДДС.

## Data Model

### Расширения существующих таблиц

`categories`:
- `cashflow_section` ENUM('operational', 'investing', 'financing') NULLABLE — раздел МСФО

`transactions`:
- `bank_account_id` UUID NULLABLE FK → `bank_accounts`
- `import_id` UUID NULLABLE FK → `bank_imports`
- `raw_description` TEXT — оригинальное «назначение платежа» из выписки
- `external_id` VARCHAR — ID операции в банке (для дедупа повторных загрузок)
- `is_inter_account_transfer` BOOLEAN DEFAULT FALSE
- `linked_transfer_id` UUID NULLABLE FK → `transactions.id` (зеркальная запись трансфера)

### Новые таблицы

`bank_accounts`:
```
id (uuid PK), name (varchar), bank_code (varchar — 'tochka'|'ozon'),
account_number (varchar nullable), currency (varchar default 'RUB'),
opening_balance (decimal 15,2 default 0), opening_date (date nullable),
is_active (bool default true), created_at, updated_at
```

`bank_imports`:
```
id, bank_account_id (FK), file_name (varchar),
period_start (date), period_end (date),
total_rows (int), imported_rows (int), skipped_duplicates (int),
status (varchar — 'pending'|'completed'|'failed'),
error_message (text nullable), imported_by (uuid),
created_at
```

`import_rules`:
```
id, match_type (varchar — 'inn'|'name_keyword'|'description_keyword'),
match_value (varchar),
counterparty_id (FK nullable), category_id (FK nullable),
is_inter_transfer (bool default false),
hit_count (int default 0), last_used_at (timestamp nullable),
created_at
```

## Bank Statement Parser

`backend/src/services/bank-parsers/`:
- `tochka.parser.ts`
- `ozon.parser.ts`
- `index.ts` — фабрика по `bank_code`, авто-определение банка по сигнатурам в файле
- `types.ts` — `NormalizedRow` интерфейс

Библиотека: `xlsx` (SheetJS).

`NormalizedRow`:
```ts
{
  external_id?: string,
  date: string,                    // ISO YYYY-MM-DD
  type: 'income' | 'expense',
  amount: number,                  // положительное
  counterparty_name: string,
  counterparty_inn?: string,
  description: string,
  raw: Record<string, any>,
}
```

**Калибровка под реальные выписки:** нужны примеры от Точки и Озона за прошлый месяц. Парсер ищет колонки по эвристике (по словам в заголовке), не по индексу.

## Import Workflow

Страница: `/financial-reports/import`

**5 шагов:**
1. Загрузка файла → выбор счёта (или автоопределение)
2. Превью: таблица со строками + цветовое кодирование (зелёный/жёлтый/красный/синий/серый)
3. Ручная разметка жёлтых/красных строк (автокомплит контрагентов, кнопка создать нового)
4. Галочка «Запомнить для следующих выписок» → создаётся `import_rule`
5. Кнопка «Импортировать N строк» → backend создаёт `transactions` с `import_id`

**API:**
- `POST /api/bank-imports/preview` — multipart/form-data, без сохранения
- `POST /api/bank-imports/commit` — обогащённые строки + правила
- `GET /api/bank-accounts`
- `GET/DELETE /api/import-rules`

**Применение правил:** при превью бэкенд для каждой строки проверяет правила в порядке: ИНН → name_keyword → description_keyword. Первое совпадение — подсвечивается в строке как авто-подсказка.

## Inter-Bank Transfer Deduplication

При парсинге строки бэкенд ищет зеркальную запись в `transactions`:
- Та же сумма
- Дата ±2 дня
- Противоположный тип
- На счёте, отличном от текущего импорта

Найдена → строка превью маркируется 🔄 с предложением связать. Юзер подтверждает → обе записи получают `is_inter_account_transfer=true` и взаимные `linked_transfer_id`.

Ручная пометка пост-импорта: кнопка «🔄 Это перевод» в `Transactions`.

**Влияние на БДДС:** агрегация исключает `is_inter_account_transfer=true`. Реестр транзакций показывает обе записи со значком.

## БДДС Report

Страница: `/financial-reports/cashflow`

**Шапка с фильтрами (sticky):**
- Период (диапазон дат + быстрые пресеты «Этот год», «Прошлый год»)
- Гранулярность: месяц / неделя
- Счета: чекбоксы Точка / Озон
- Раздел: чекбоксы операционная / инвестиционная / финансовая
- Контрагент (автокомплит, опц.)
- Проект, департамент (опц.)

**Структура таблицы:**
```
                          | Янв | Фев | ... | Итого
ОСТАТОК НА НАЧАЛО         |
─── ОПЕРАЦИОННАЯ ───
  ▼ Поступления
    Категория 1           |
    ...
    Итого поступлений     |
  ▼ Выплаты
    Категория N           |
    ...
    Итого выплат          |
  ЧИСТЫЙ ОПЕРАЦИОННЫЙ     |
─── ИНВЕСТИЦИОННАЯ ───
  (...)
─── ФИНАНСОВАЯ ───
  (...)
ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК     |
ОСТАТОК НА КОНЕЦ          |
```

**Поведение:**
- Клик по строке категории → раскрытие детализации по контрагентам
- Клик по ячейке → выезжает боковая панель со списком транзакций
- Двойной клик → переход на `/transactions` с фильтрами
- Свернуть/развернуть раздел → сохранение в `localStorage`
- Кнопка «↓ Excel» — экспорт в .xlsx

**Расчёт остатков:**
- На начало берётся `bank_accounts.opening_balance` для самой ранней даты периода и плюс/минус движения до начала отчёта
- На конец = на начало + чистый поток за период
- Если все счета без `opening_balance` — отчёт показывает только потоки

**Категории без cashflow_section:** отдельный блок «Без раздела» в самом низу отчёта со ссылкой *«Проставить разделы»* → ведёт на `/categories`.

**API:**
```
GET /api/cashflow?from=&to=&granularity=&accounts=&counterparty_id=&project_id=&department_id=
→ {
  periods: [{start, end, label}, ...],
  sections: [{
    code: 'operational' | 'investing' | 'financing',
    inflows: [{ category_id, name, values: number[] }],
    outflows: [{ category_id, name, values: number[] }],
    net: number[],
  }],
  unsorted: [{ category_id, name, values, type }] | null,  // категории без раздела
  opening_balance: number,
  closing_balance: number,
  net_cash_flow: number[]
}
```

Один SQL-запрос: `GROUP BY date_trunc('month', date), category_id, type` + агрегация в TS.

## Migration Strategy

1. SQL миграция через Supabase MCP: новые таблицы + поля
2. Сидинг: 2 записи в `bank_accounts` (Точка, Озон) — `opening_balance`/`opening_date` пользователь задаёт сам в UI
3. Существующие категории получают `cashflow_section = NULL` → пользователь проставляет вручную через `/categories`
4. Backwards compatibility: существующие транзакции без `bank_account_id` показываются в БДДС как «Без счёта»

## Out of Scope (Phase 1)

- Валютные операции (currency=RUB фиксировано)
- API-интеграция с банками (только Excel-импорт)
- Экспорт БДДС в PDF (только Excel)
- Многопользовательский импорт (один юзер импортирует за раз)
- Автоматическая категоризация по ML/embeddings (только rule-based)

## Open Questions

- Реальная структура колонок в выписках Точки и Озона (требуются примеры файлов)
- Нужны ли субкатегории в БДДС (например, «Сырьё → Реактивы», «Сырьё → Упаковка»)? Сейчас плоский список.

## Dependencies

- npm: `xlsx` (для парсинга и экспорта)
- Существующие модули: `Transactions`, `Categories`, `Counterparties`, `Departments`, `Projects`

## Risks

- **Парсер хрупкий к изменениям формата выписки** — митигация: эвристический поиск колонок по заголовкам, тесты на реальных файлах
- **Дедупликация трансферов может ложно срабатывать** при совпадении сумм — митигация: ручное подтверждение в превью, легкая разлинковка постфактум
- **Большая выписка (>1000 строк)** может тормозить превью — митигация: пагинация в UI или ограничение по периоду
