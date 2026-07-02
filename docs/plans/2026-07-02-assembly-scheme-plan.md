# Assembly Scheme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (или Workflow-оркестрация) to implement this plan task-by-task.

**Goal:** Страница «Схема сборки» — коллапсибл-дерево производства (справа-налево) с rollup себестоимости (материалы + работа), карточками операций (норматив × ставка 500 ₽/ч) и базой знаний регламентов.

**Architecture:** Слой `assembly_operations` поверх существующего BOM (`component_parts`), операции привязаны к композитам. Backend собирает всё дерево одним endpoint из 3 batch-запросов. Frontend — рекурсивный React-компонент без graph-библиотек. База знаний — brand_docs со слагами `kb-*`.

**Tech Stack:** TypeORM + raw SQL (Supabase MCP для DDL), Express, React + TS + Tailwind. Без новых npm-зависимостей.

**Design:** `docs/plans/2026-07-02-assembly-scheme-design.md`

**Testing note:** Проект без test runner: каждая задача — typecheck + smoke; финал — Playwright e2e.

---

## Task 1: Миграция БД

**Files:**
- Create: `backend/src/migrations/2026-07-02-assembly-operations.sql`

**Step 1:** Создать файл:

```sql
-- Схема сборки: операции поверх BOM (component_parts).
-- Операция привязана к КОМПОЗИТУ (сущности, которую производит), не к ребру:
-- у узла может быть несколько операций (розлив + закупорка), стоимость работы
-- узла = Σ time_seconds/3600 × ставка (app_settings.labor_rate_per_hour).

CREATE TABLE IF NOT EXISTS assembly_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_id uuid NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  stage int NOT NULL DEFAULT 0,
  time_seconds int,
  instruction_slug varchar(100),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assembly_ops_composite ON assembly_operations (composite_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key varchar(100) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO app_settings (key, value) VALUES ('labor_rate_per_hour', '500')
ON CONFLICT (key) DO NOTHING;
```

**Step 2:** Применить через Supabase MCP `apply_migration` (project `jubkezbvccwvujregkfq`, name `2026_07_02_assembly_operations`).

**Step 3:** Verify через `execute_sql`: обе таблицы существуют, `SELECT value FROM app_settings WHERE key='labor_rate_per_hour'` → `500`.

**Step 4:** Commit: `feat(assembly): migration — assembly_operations + app_settings (labor rate)`

---

## Task 2: Данные — фасовки ЭХ, деревья Х/ЭХ, каркас операций

Через Supabase MCP `execute_sql` (данные, не DDL). Файл-протокол: `backend/src/migrations/2026-07-02-assembly-data.sql` (записать выполненный SQL для истории, коммитить).

**Step 1: Пересборка фасовок ЭХ** (уточнение пользователя: SnCl₂/KIO₃ — баночки, не капсулы):

```sql
-- Капсула -> Баночка (переименование + замена тары)
UPDATE components SET name = 'Баночка с хлоридом олова',
  notes = 'ЭХ: 4 г в баночке с белой крышкой' WHERE name = 'Капсула с хлоридом олова';
UPDATE components SET name = 'Баночка с иодатом калия',
  notes = 'ЭХ: 4 г в баночке с белой крышкой' WHERE name = 'Капсула с иодатом калия';
UPDATE component_parts cp SET part_id = jar.id
FROM components comp, components caps, components jar
WHERE cp.composite_id = comp.id AND cp.part_id = caps.id
  AND comp.name IN ('Баночка с хлоридом олова','Баночка с иодатом калия')
  AND caps.name = 'Капсулы 4 г' AND jar.name = 'Баночки с белой крышкой';
```

Новые фасовки (шаблон одинаковый — компонент is_composite + 2 части):
- «Баночка с серой»: `Баночка с черной крышкой` ×1 + `Сера` 10 г
- «Пакетик с магнием»: `Пакетики` ×1 + `Магний` 3 г
- «Пакетик с железной ватой»: `Пакетики` ×1 + `Железная вата` 3.2 г
- «Пакетик с медью»: `Пакетики` ×1 + `Медь` 2.5 г

⚠️ Имена частей (`Сера`, `Магний`, `Железная вата`, `Медь`, `Пакетики`) СНАЧАЛА проверить SELECT'ом — в БД могут быть варианты («Медь (порошок)» и т.п.). Если вещества нет — создать (category `reagent`/`metal`, цены из листа ЭХ: S 475₽/1000г, Mg 1500/1000, Fe 8190/5000, Cu 2500/1000 → price_per_gram).

**Step 2: Химичка 3.0 — реструктуризация этапов 8/9 + верхний узел:**

```sql
-- Новый узел «Дно + печатная продукция Химичка 3.0» (этап 8)
INSERT INTO components (id, name, category, is_composite, quantity_per_kit)
VALUES (gen_random_uuid(), 'Дно + печатная продукция Химичка 3.0', 'equipment', true, 1);
-- Перенести Укомпл. дно + Методичка + Листовки из «Собранный набор» в новый узел;
-- «Собранный набор» = новый узел + Крышка коробки (этап 9).
-- «Набор в защитном коробе Химичка 3.0» (этап 10) = Готовый набор ×1
--   (существующий «Готовый набор» уже содержит Собранный набор + Защитную коробку —
--   переименовать «Готовый набор» → «Набор в защитном коробе Химичка 3.0» и НЕ городить лишний уровень).
```

Точная механика: SELECT текущих связей «Собранный набор» → UPDATE composite_id у частей Методичка/Листовки на новый узел + INSERT нового узла в «Собранный набор». Имплементер обязан сначала снять фактическое состояние дерева.

**Step 3: Дерево ЭХ с нуля.** Новые компоненты (category `equipment`, is_composite, цена 0 где закупки нет):
- `Ложемент для флаконов ЭХ` (0 ₽, notes 'цена не внесена'), `Ложемент пробирочный ЭХ (чёрный)` (0 ₽)
- `Коробочка твёрдых реактивов ЭХ` (тара 0 ₽), `Коробочка лабораторного оборудования ЭХ` (тара 0 ₽)
- `Коробка ЭХ (дно+крышка)` — одна закупочная позиция листа (212.2 ₽): unit_price 212.2
- `Защитная коробка ЭХ` — 29.13 ₽ (если нет в components — создать)

Композиты-сборки ЭХ (INSERT components is_composite + component_parts):

| Сборка | Части |
|---|---|
| ✅ Готовый ложемент флаконов ЭХ | Ложемент для флаконов ЭХ ×1 + 6 растворов: гидросульфата натрия 5%, дихромата калия 6%, иодида калия 3%, гидроксида натрия 7%, серной кислоты 8%, хлорида железа III 5% |
| ✅ Готовый ложемент пробирок ЭХ | Ложемент пробирочный ЭХ ×1 + Пробирки ×6 |
| Наполн. коробочка тв. реактивов ЭХ | Коробочка ×1 + Баночка с серой + Баночка с хлоридом олова + Баночка с иодатом калия + Пакетик с магнием + Пакетик с железной ватой + Пакетик с медью + Капсула с цинком |
| Наполн. коробочка лаб. оборудования ЭХ | Коробочка ×1 + мелкое оборудование из листа ЭХ (Очки, Чашка Петри, Стаканчики ×2, Наперсток, Пробирка пластиковая, Шпатель, Батарейки ×3, Графитовые стержни, Двухсторонний провод, Светодиод, Коробочка для батареек, ершик, Пипетки ×3 — имена проверить SELECT'ом, брать существующие) |
| Наполн. дно коробки ЭХ | Коробка ЭХ ×1 + оба ложемента + обе коробочки + штативы + зажимы + Баночки с белой крышкой (пустая посуда, если по листу «в набор» больше, чем занято фасовками) |
| Дно + печатная продукция ЭХ | Наполн. дно ×1 + Методичка ×1 + Листовки ×1 |
| Собранный набор ЭХ | Дно+печатка ×1 (закрытие крышкой — операция без отдельного материала: крышка в составе «Коробка ЭХ») |
| Набор в защитном коробе ЭХ | Собранный набор ЭХ ×1 + Защитная коробка ЭХ ×1 |

**Step 4: Каркас операций** — INSERT ... SELECT по паттернам:

```sql
-- Растворы: розлив (1) + закупорка (2)
INSERT INTO assembly_operations (composite_id, name, stage, sort_order)
SELECT id, 'Розлив', 1, 1 FROM components WHERE is_composite AND name LIKE 'Раствор%';
INSERT INTO assembly_operations (composite_id, name, stage, sort_order)
SELECT id, 'Закупорка и проклейка', 2, 2 FROM components WHERE is_composite AND name LIKE 'Раствор%';
-- Фасовки (3)
INSERT INTO assembly_operations (composite_id, name, stage, sort_order)
SELECT id, 'Фасовка', 3, 1 FROM components WHERE is_composite
  AND (name LIKE 'Капсула с%' OR name LIKE 'Баночка с серой' OR name LIKE 'Баночка с хлоридом%' OR name LIKE 'Баночка с иодатом%' OR name LIKE 'Пакетик с%');
-- Ложементы флаконов (4), пробирок (5), коробочки (6), дно (7), печатка (8), закрытие (9), короб (10)
-- — аналогичные INSERT SELECT по точным именам узлов (списком IN (...)).
```

**Step 5: Verify** — контрольные SELECT: у каждого раствора 2 операции; дерево ЭХ от «Набор в защитном коробе ЭХ» обходится вглубь до листьев; нет циклов.

**Step 6:** Записать выполненный SQL в `backend/src/migrations/2026-07-02-assembly-data.sql`, commit: `feat(assembly): данные — фасовки ЭХ, деревья Х3.0/ЭХ, каркас операций`

---

## Task 3: Backend — entities + assembly API

**Files:**
- Create: `backend/src/entities/AssemblyOperation.ts`, `backend/src/entities/AppSetting.ts`
- Modify: `backend/src/config/database.ts` (⚠️ ОБЯЗАТЕЛЬНО добавить оба в явный массив `allEntities` — glob-discovery в проекте НЕТ)
- Create: `backend/src/controllers/assembly.controller.ts`, `backend/src/routes/assembly.routes.ts`
- Modify: `backend/src/server.ts` (import + `app.use('/api/assembly', authMiddleware, assemblyRoutes)`)

**Entities:** стандартные декораторы проекта (см. `BankSyncConfig.ts` за образец): AssemblyOperation → `@Entity('assembly_operations')`, поля как в миграции, `string | null` для nullable. AppSetting → `@Entity('app_settings')`, key PK varchar, value jsonb (`@Column({ type: 'jsonb' })`).

**Controller `assembly.controller.ts`:**

```typescript
// GET /api/assembly/roots — корни: components с именами 'Набор в защитном коробе %'
// GET /api/assembly/tree?root=<uuid> — всё дерево + rollup:
//   1) SELECT * FROM component_parts (весь, ~200 строк)
//   2) SELECT id, name, category, is_composite, unit_price, price_per_gram FROM components
//   3) SELECT * FROM assembly_operations
//   4) labor rate из app_settings (дефолт 500 + console.warn)
//   Обход от root с visited-Set (циклы обрубаются, warning в ответ meta.warnings).
//   Узел: { id, name, isComposite, stageMax, materialCost, laborCost, totalCost,
//           quantity (от родителя), operations: [{id,name,stage,timeSeconds,laborCost,instructionSlug}],
//           children: [...] }
//   Лист: materialCost = category in ('reagent','metal') ? qty*price_per_gram : qty*unit_price.
//   Композит: materialCost = Σ child.totalCost*qty; laborCost = Σ ops time/3600*rate;
//   totalCost = materialCost + laborCost. Всё за один проход, O(N).
// POST /api/assembly/operations  { composite_id, name, stage, time_seconds?, instruction_slug?, sort_order? }
// PUT /api/assembly/operations/:id  (partial: те же поля)
// DELETE /api/assembly/operations/:id
// GET /api/assembly/settings/labor-rate → { rate: number }
// PUT /api/assembly/settings/labor-rate { rate } (upsert app_settings)
```

Error-паттерн проекта: try/catch, `console.error('[assembly.<method>]', e?.message || e)`, 500 с русским сообщением.

**Verify:** `cd backend && npx tsc --noEmit` чисто; локальный запуск + `curl /api/assembly/roots` (с JWT) возвращает 2 корня.

**Commit:** `feat(assembly): backend — entities, tree endpoint with cost rollup, operations CRUD`

---

## Task 4: Frontend — страница «Схема сборки»

**Files:**
- Create: `frontend/src/api/assembly.ts` (типы AssemblyNode/AssemblyOperation + assemblyApi: roots, tree, updateOperation, createOperation, deleteOperation, getLaborRate, setLaborRate)
- Create: `frontend/src/pages/AssemblyScheme.tsx`
- Create: `frontend/src/components/assembly/AssemblyTree.tsx`, `AssemblyNodeCard.tsx` (правая панель)

**Дерево (AssemblyTree):**
- Layout: горизонтальный flex, **корень справа** (`flex-row-reverse` на уровне контейнера), дети раскрываются влево. Рекурсивный компонент `<TreeBranch node depth>`: колонка детей слева, вертикальная SVG/CSS-скобка к родителю справа
- Узел-чип: название (truncate + title), `totalCost ₽` жирным, серым `материалы + работа`, чип этапа (максимальный stage операций), кнопка ± для collapse (дефолт: раскрыт 1 уровень от корня)
- Состояние: `expanded: Set<string>` useState; выбранный узел `selectedId`
- Клик по узлу ИЛИ по соединительной линии (линия — кликабельный `<div>`/`<svg>` с расширенной hit-area) → `setSelectedId(node.id)` → правая панель
- Ничего тяжёлого: дерево приходит целиком (один fetch), рендер ленивый по expanded

**Правая панель (AssemblyNodeCard):**
- Заголовок узла, себестоимость: материалы / работа / итого
- Список операций: имя, этап, норматив (сек) — **инлайн-редактор** (input → onBlur → `assemblyApi.updateOperation`, optimistic + refetch tree), стоимость работы, бейдж «норматив не заполнен» если NULL
- Регламент: если `instructionSlug` есть — ссылка «Открыть регламент» на `/production/knowledge-base?doc=<slug>`; селектор привязки (список kb-доков из brandDocsApi.list с фильтром `kb-`)
- «+ Операция» (имя, этап), удаление операции (confirm)
- Состав: части с qty и ценой

**Страница AssemblyScheme:** селектор корня (roots), ставка ₽/час (инлайн-редактор для admin), дерево + панель. Загрузка/ошибки по паттернам проекта.

**Verify:** typecheck чисто.

**Commit:** `feat(assembly): frontend — схема сборки (коллапсибл-дерево + карточка операций)`

---

## Task 5: Frontend — «База знаний»

**Files:**
- Create: `frontend/src/pages/KnowledgeBase.tsx`

Паттерн — `StrategyDocSection` (brandDocsApi + textarea):
- Список: `brandDocsApi.list()` → фильтр `slug.startsWith('kb-')`; карточки: title, updated_at
- Создание: имя → слаг `kb-<translit>`; редактор: title + textarea content (markdown), сохранение `brandDocsApi.upsert`
- `?doc=<slug>` в URL — открыть документ сразу (useSearchParams)
- Просмотр: `<pre className="whitespace-pre-wrap">` (markdown-рендер — v2; без новых зависимостей)

**Verify:** typecheck.

**Commit:** `feat(assembly): база знаний — регламенты на brand_docs (kb-* слаги)`

---

## Task 6: Роуты + сайдбар (общие файлы — отдельной задачей, после 4 и 5)

**Files:**
- Modify: `frontend/src/App.tsx` — рядом с `/quality-control` (строка ~126): `<Route path="/production/assembly" element={<AssemblyScheme />} />`, `<Route path="/production/knowledge-base" element={<KnowledgeBase />} />` + импорты
- Modify: `frontend/src/components/Layout.tsx` — секция «Производство» (строка ~319): пункты «Схема сборки» → `/production/assembly`, «База знаний» → `/production/knowledge-base` (иконки по образцу соседних)

**Verify:** typecheck; vite dev — страницы открываются из сайдбара.

**Commit:** `feat(assembly): routes + sidebar — Схема сборки, База знаний`

---

## Task 7: E2E + push

**Step 1:** Локальный стенд: backend `PORT=3002 node dist/server.js` (после `npm run build`), frontend `VITE_API_URL=http://localhost:3002/api npx vite --port 5173`. Логин e2e-пользователем (создать временно, как в прошлый раз, удалить после).

**Step 2 (Playwright):**
1. `/production/assembly` → селектор показывает 2 корня (Х 3.0, ЭХ)
2. Дерево Х 3.0: корень справа, ➕ раскрывает влево; контрольный узел «Раствор сульфата меди 5%» → материалы 8.05 ₽
3. Клик на узел → карточка: 2 операции (Розлив, Закупорка), «норматив не заполнен»
4. Ввести норматив 120 сек → стоимость работы 16.67 ₽ (120/3600×500), totalCost узла вырос, rollup родителей пересчитался
5. ЭХ: дерево обходится до листьев, коробочка тв. реактивов содержит 7 фасовок
6. База знаний: создать «kb-розлив-растворов» → привязать к операции «Розлив» → ссылка из карточки открывает док
7. Console без ошибок
8. Убрать тестовый норматив (вернуть NULL) или оставить по решению пользователя — зафиксировать в отчёте

**Step 3:** `git push origin main && git push vercel-deploy main`; прод-smoke пунктов 1-3 на erp.ximi4ka.ru.

**Commit merge-финал не нужен (прямые коммиты в main).**

---

## Параллелизация (для Workflow-оркестрации)

- Task 1 → Task 2 → Task 3 строго последовательно (данные → API)
- Task 4 и Task 5 параллельно ПОСЛЕ Task 3 (не трогают общие файлы — App.tsx/Layout.tsx вынесены в Task 6)
- Task 6 после 4 и 5; Task 7 финал
- Каждая задача: implementer → spec-review → quality-review (двухступенчатое ревью)

## Reference

- Дизайн: `docs/plans/2026-07-02-assembly-scheme-design.md`
- Образцы кода: `bank-sync.controller.ts` (error-паттерн), `StrategyDocSection.tsx` (brand_docs editor), `OkrKrSelector.tsx` (инлайн-селекторы)
- @superpowers:systematic-debugging при сбоях smoke
