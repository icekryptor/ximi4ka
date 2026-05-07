# Контент-банк Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Заменить старую страницу «Контентные единицы» на «Контент-банк» — каталог разнотипного контента с 7-стейдж workflow, рубриками-как-CRUD и per-network публикациями. Загрузить seed из 95 идей и 6 рубрик.

**Architecture:** 3 новые таблицы (`content_rubrics`, `content_units`, `content_publications`) — старая `content_units` дропается полностью. Backend: TypeORM-сущности + чистые CRUD-роуты, удаляются три интеграции (YaDisk/Sheets/YouTube). Frontend: одна страница `/content-bank` с table-view, URL-stateful фильтрами, edit-модалкой через `createPortal(..., document.body)`. Миграция разрушительная — все старые записи стираются.

**Tech Stack:** Express + TypeORM + PostgreSQL (Supabase) на бэке, React 18 + TS + Vite + TailwindCSS на фронте. Деплой: Vercel (фронт) + Railway (бэк) — push в **оба** remote'а.

**Design doc:** [2026-05-07-content-bank-design.md](2026-05-07-content-bank-design.md)

---

## Notes for the Executor

- Проект **не имеет тест-инфраструктуры** — ни vitest, ни jest. Каждая задача завершается **мануальной верификацией**, не автоматическим тестом. TDD-паттерн «failing test → implement → passing test» заменяется на «implement → run typecheck → smoke-проверка вручную».
- **Russian text в UI** — копируется ровно как в плане, без перевода.
- **Все модалки** используют `import { createPortal } from 'react-dom'` и `return createPortal(<JSX>, document.body)` — иначе ломается из-за containing-block (см. commit `446ce0e`).
- **Frequent commits** — каждый коммит мелкий, описательный, по одной задаче. Не батчим.
- **Не пушим в прод** до конца плана — на проде поломается, потому что таблица меняется. Пушим только когда фронт+бэк+миграция+seed готовы (Stage 8).
- **Seed-данные:** JSON-файл лежит у пользователя на `~/Desktop/chemichka_content_bank.json`. Перенести в `backend/src/seeds/data/chemichka_content_bank.json` на ранней стадии плана.
- При работе с TypeORM — миграция через SQL-файл, а не `migration:generate`, потому что разрушительный `DROP TABLE` плохо ловится автогенератором.

---

## Stage Overview

| Stage | Что | Задач | Коммитов |
|---|---|---|---|
| 1 | Backend: подготовка — копируем JSON seed, sql migration, удаляем legacy services | 4 | 4 |
| 2 | Backend: TypeORM entities (3 файла) | 3 | 3 |
| 3 | Backend: контроллеры + роуты (rubrics, units, publications) | 4 | 4 |
| 4 | Backend: seed-скрипт | 2 | 2 |
| 5 | Frontend: foundation (networks lib, API-модуль, lucide-расширения) | 3 | 3 |
| 6 | Frontend: страница ContentBank с фильтрами и таблицей | 4 | 4 |
| 7 | Frontend: edit-модалка + PublicationsEditor + RubricsManagerModal | 5 | 5 |
| 8 | Migration & deploy — backup БД, накат миграции, seed, push, smoke | 5 | 1–2 |

Total: **~30 задач, ~25 коммитов.**

---

## Stage 1 — Backend: подготовка

### Task 1.1: Перенести JSON-seed в проект

**Files:**
- Create: `backend/src/seeds/data/chemichka_content_bank.json`

**Step 1:** Скопировать файл:
```bash
mkdir -p backend/src/seeds/data
cp ~/Desktop/chemichka_content_bank.json backend/src/seeds/data/chemichka_content_bank.json
```

**Step 2:** Проверить, что файл читается:
```bash
cd backend && node -e "console.log(require('./src/seeds/data/chemichka_content_bank.json').meta)"
```
Expected: `{ name: 'Химичка контент-банк', version: '1.0', ... }`.

**Step 3:** Commit:
```bash
git add backend/src/seeds/data/chemichka_content_bank.json
git commit -m "chore(content-bank): vendor chemichka_content_bank.json seed (95 ideas, 6 rubrics)"
```

### Task 1.2: SQL-миграция (разрушительная)

**Files:**
- Create: `backend/src/migrations/2026-05-07-content-bank.sql`

**Step 1:** Создать файл с SQL:
```sql
-- 2026-05-07 content-bank — wipe legacy ContentUnit and create new schema
-- Run on Supabase via SQL console BEFORE deploying backend code.

BEGIN;

-- 1. Wipe legacy
DROP TABLE IF EXISTS content_units CASCADE;

-- 2. Rubrics (CRUD)
CREATE TABLE content_rubrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  emoji         VARCHAR(8),
  tone          TEXT,
  audience      TEXT,
  cta_template  TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Units (main entity, replaces old content_units)
CREATE TABLE content_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id     UUID REFERENCES content_rubrics(id) ON DELETE SET NULL,
  content_type  VARCHAR(20) NOT NULL DEFAULT 'short_video',
  status        VARCHAR(20) NOT NULL DEFAULT 'idea',
  complexity    SMALLINT,
  title         VARCHAR(500) NOT NULL,
  hook          TEXT,
  hook_ab       TEXT,
  visual        TEXT,
  essence       TEXT,
  notes         TEXT,
  video_url     VARCHAR(1000),
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_rubric  ON content_units (rubric_id);
CREATE INDEX idx_units_status  ON content_units (status);
CREATE INDEX idx_units_type    ON content_units (content_type);
CREATE INDEX idx_units_created ON content_units (created_at DESC);

-- 4. Publications (per-network rows)
CREATE TABLE content_publications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_unit_id UUID NOT NULL REFERENCES content_units(id) ON DELETE CASCADE,
  network         VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  published_url   VARCHAR(1000),
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_unit_id, network)
);
CREATE INDEX idx_publications_unit      ON content_publications (content_unit_id);
CREATE INDEX idx_publications_network   ON content_publications (network);
CREATE INDEX idx_publications_scheduled ON content_publications (scheduled_at);

COMMIT;
```

**Step 2:** Не запускаем сейчас. Накат — в Stage 8 на проде после backup'а.

**Step 3:** Commit:
```bash
git add backend/src/migrations/2026-05-07-content-bank.sql
git commit -m "feat(content-bank): SQL migration — wipe legacy + 3 new tables"
```

### Task 1.3: Удалить legacy services

**Files:**
- Delete: `backend/src/services/yadisk-download.service.ts`
- Delete: `backend/src/services/google-sheets.service.ts`
- Delete: `backend/src/services/youtube.service.ts`

**Step 1:** Перед удалением — проверить, что ни один из этих сервисов не импортируется откуда-то ещё, кроме `content-unit.controller.ts`:
```bash
grep -rn "yadisk-download\|google-sheets\|youtube\.service" backend/src/ --include="*.ts" | grep -v "content-unit.controller.ts"
```
Expected: пусто или только legacy-реэкспорты в самом `content-unit.controller.ts`.

Если найдены другие потребители — **остановиться** и обсудить с пользователем (например, `google-sheets.service.ts` мог использоваться в WB-finance или ещё где-то).

**Step 2:** Удалить файлы:
```bash
rm backend/src/services/yadisk-download.service.ts
rm backend/src/services/google-sheets.service.ts
rm backend/src/services/youtube.service.ts
```

**Step 3:** Если есть отдельный `routes/youtube.routes.ts` или `controllers/youtube.controller.ts` — их тоже удалить + снять регистрацию из `index.ts`/`server.ts`. Сделать `grep -rn "youtube.routes\|youtube.controller" backend/src/` чтобы проверить.

**Step 4:** Backend пока **не компилируется**, потому что `content-unit.controller.ts` ссылается на удалённые сервисы — это исправляется в Task 3.2. Это нормально, временное состояние.

**Step 5:** Commit (даже с ломаной сборкой — следующая задача починит):
```bash
git add backend/src/services backend/src/routes backend/src/controllers backend/src/index.ts backend/src/server.ts
git commit -m "feat(content-bank): drop legacy YaDisk + Sheets + YouTube services"
```

### Task 1.4: Проверить package.json — нужно ли убирать deps

**Files:**
- Modify: `backend/package.json`

**Step 1:** Проверить, какие npm-пакеты использовались только в удалённых сервисах:
```bash
grep -rn "googleapis\|google-spreadsheet" backend/src/ --include="*.ts"
```
Если осталось 0 совпадений — `googleapis` можно убрать из `dependencies`. Аналогично для других пакетов специфичных под YaDisk/Sheets (typed `axios` requests их не требуют — основной axios уже в проекте).

**Step 2:** Если зависимости нужно убрать:
```bash
cd backend && npm uninstall googleapis
```
(Список пакетов под удаление — определяется из step 1.)

**Step 3:** Commit:
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(content-bank): drop unused npm deps after legacy service removal"
```

(Если ничего удалять не нужно — пропускаем эту задачу без коммита.)

---

## Stage 2 — Backend: TypeORM entities

### Task 2.1: Entity `ContentRubric`

**Files:**
- Create: `backend/src/entities/ContentRubric.ts`

**Step 1:** Записать содержимое:
```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'

@Entity('content_rubrics')
export class ContentRubric {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'varchar', length: 8, nullable: true })
  emoji: string | null

  @Column({ type: 'text', nullable: true })
  tone: string | null

  @Column({ type: 'text', nullable: true })
  audience: string | null

  @Column({ type: 'text', nullable: true })
  cta_template: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ContentUnit, (u) => u.rubric)
  units: ContentUnit[]
}
```

**Step 2:** Commit (typecheck сейчас сломан, но это окей — починится в 2.2):
```bash
git add backend/src/entities/ContentRubric.ts
git commit -m "feat(content-bank): add ContentRubric entity"
```

### Task 2.2: Entity `ContentUnit` (заново — старая дропается полностью)

**Files:**
- Replace: `backend/src/entities/ContentUnit.ts`

**Step 1:** Полностью переписать файл:
```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { ContentRubric } from './ContentRubric'
import { ContentPublication } from './ContentPublication'

export type ContentType = 'short_video' | 'text_post' | 'other'

export type ContentStatus =
  | 'idea'
  | 'script'
  | 'filming'
  | 'editing'
  | 'ready'
  | 'published'
  | 'rejected'

@Entity('content_units')
export class ContentUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', nullable: true })
  rubric_id: string | null

  @ManyToOne(() => ContentRubric, (r) => r.units, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rubric_id' })
  rubric: ContentRubric | null

  @Column({ type: 'varchar', length: 20, default: 'short_video' })
  content_type: ContentType

  @Column({ type: 'varchar', length: 20, default: 'idea' })
  status: ContentStatus

  @Column({ type: 'smallint', nullable: true })
  complexity: number | null

  @Column({ type: 'varchar', length: 500 })
  title: string

  @Column({ type: 'text', nullable: true })
  hook: string | null

  @Column({ type: 'text', nullable: true })
  hook_ab: string | null

  @Column({ type: 'text', nullable: true })
  visual: string | null

  @Column({ type: 'text', nullable: true })
  essence: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'varchar', length: 1000, nullable: true })
  video_url: string | null

  @Column({ type: 'uuid' })
  created_by: string

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ContentPublication, (p) => p.content_unit)
  publications: ContentPublication[]
}
```

**Step 2:** Commit:
```bash
git add backend/src/entities/ContentUnit.ts
git commit -m "feat(content-bank): rewrite ContentUnit entity (rubric, type, status, hook fields)"
```

### Task 2.3: Entity `ContentPublication`

**Files:**
- Create: `backend/src/entities/ContentPublication.ts`

**Step 1:** Записать:
```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'

@Entity('content_publications')
@Unique(['content_unit_id', 'network'])
export class ContentPublication {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  content_unit_id: string

  @ManyToOne(() => ContentUnit, (u) => u.publications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_unit_id' })
  content_unit: ContentUnit

  @Column({ type: 'varchar', length: 50 })
  network: string

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null

  @Column({ type: 'varchar', length: 1000, nullable: true })
  published_url: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

**Step 2:** Зарегистрировать сущности в `backend/src/config/database.ts` — найти массив `entities: [...]` и добавить `ContentRubric`, `ContentUnit` (уже там), `ContentPublication`. Если используется glob (`entities: ['src/entities/**/*.ts']`) — ничего делать не нужно.

**Step 3:** Backend typecheck:
```bash
cd backend && npx tsc --noEmit
```
Expected: ошибки в `controllers/content-unit.controller.ts` (он ссылается на удалённые сервисы и старые поля), но **не в новых entities**. Если в новых entities ошибки — исправить перед коммитом.

**Step 4:** Commit:
```bash
git add backend/src/entities/ContentPublication.ts backend/src/config/database.ts
git commit -m "feat(content-bank): add ContentPublication entity"
```

---

## Stage 3 — Backend: контроллеры + роуты

### Task 3.1: Контроллер `content-rubric.controller.ts`

**Files:**
- Create: `backend/src/controllers/content-rubric.controller.ts`

**Step 1:** Записать:
```ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentRubric } from '../entities/ContentRubric'

const repo = AppDataSource.getRepository(ContentRubric)

export const contentRubricController = {
  async getAll(req: Request, res: Response) {
    try {
      const items = await repo.find({ order: { sort_order: 'ASC', title: 'ASC' } })
      res.json(items)
    } catch (e) {
      console.error('Error fetching rubrics:', e)
      res.status(500).json({ error: 'Ошибка загрузки рубрик' })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Рубрика не найдена' })
      res.json(item)
    } catch (e) {
      console.error('Error fetching rubric:', e)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const item = repo.create(req.body)
      const saved = await repo.save(item)
      res.status(201).json(saved)
    } catch (e: any) {
      console.error('Error creating rubric:', e)
      const msg = e?.code === '23505' ? 'Рубрика с таким slug уже существует' : 'Ошибка создания'
      res.status(400).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Рубрика не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({ where: { id: req.params.id } })
      res.json(updated)
    } catch (e) {
      console.error('Error updating rubric:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Рубрика не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting rubric:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
```

**Step 2:** Создать роуты — `backend/src/routes/content-rubric.routes.ts`:
```ts
import { Router } from 'express'
import { contentRubricController } from '../controllers/content-rubric.controller'

const router = Router()

router.get('/', contentRubricController.getAll)
router.get('/:id', contentRubricController.getOne)
router.post('/', contentRubricController.create)
router.put('/:id', contentRubricController.update)
router.delete('/:id', contentRubricController.delete)

export default router
```

**Step 3:** Зарегистрировать в `backend/src/index.ts` (или `server.ts` — где монтируются роуты):
```ts
import contentRubricRoutes from './routes/content-rubric.routes'
// ...
app.use('/api/content-rubrics', contentRubricRoutes)
```

**Step 4:** Commit:
```bash
git add backend/src/controllers/content-rubric.controller.ts backend/src/routes/content-rubric.routes.ts backend/src/index.ts
git commit -m "feat(content-bank): add content-rubrics CRUD API"
```

### Task 3.2: Переписать `content-unit.controller.ts` (только CRUD, без legacy)

**Files:**
- Replace: `backend/src/controllers/content-unit.controller.ts`

**Step 1:** Полностью переписать:
```ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'
import { ILike } from 'typeorm'

const repo = AppDataSource.getRepository(ContentUnit)

interface AuthenticatedRequest extends Request {
  user?: { userId: string }
}

export const contentUnitController = {
  async getAll(req: Request, res: Response) {
    try {
      const {
        status,
        rubric_id,
        content_type,
        network,
        search,
        sort = 'created_at',
      } = req.query as Record<string, string | undefined>

      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))

      const qb = repo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.rubric', 'r')
        .leftJoinAndSelect('u.publications', 'p')

      if (status) qb.andWhere('u.status IN (:...statuses)', { statuses: status.split(',') })
      if (rubric_id) qb.andWhere('u.rubric_id IN (:...rubrics)', { rubrics: rubric_id.split(',') })
      if (content_type)
        qb.andWhere('u.content_type IN (:...types)', { types: content_type.split(',') })
      if (network) {
        qb.andWhere(
          'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.network IN (:...networks))',
          { networks: network.split(',') },
        )
      }
      if (search) {
        qb.andWhere(
          '(u.title ILIKE :s OR u.hook ILIKE :s OR u.hook_ab ILIKE :s OR u.essence ILIKE :s)',
          { s: `%${search}%` },
        )
      }

      // Sort
      if (sort === 'title') qb.orderBy('u.title', 'ASC')
      else if (sort === 'status') qb.orderBy('u.status', 'ASC').addOrderBy('u.created_at', 'DESC')
      else qb.orderBy('u.created_at', 'DESC')

      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()

      res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (e) {
      console.error('Error fetching units:', e)
      res.status(500).json({ error: 'Ошибка загрузки единиц' })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo.findOne({
        where: { id: req.params.id },
        relations: ['rubric', 'publications'],
      })
      if (!item) return res.status(404).json({ error: 'Единица не найдена' })
      res.json(item)
    } catch (e) {
      console.error('Error fetching unit:', e)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId
      if (!userId) return res.status(401).json({ error: 'Не авторизован' })

      const body = req.body as Partial<ContentUnit>
      const item = repo.create({
        ...body,
        created_by: userId,
        title: body.title || (body.hook ? body.hook.slice(0, 80) : 'Без названия'),
      })
      const saved = await repo.save(item)
      const full = await repo.findOne({ where: { id: saved.id }, relations: ['rubric', 'publications'] })
      res.status(201).json(full)
    } catch (e) {
      console.error('Error creating unit:', e)
      res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Единица не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({
        where: { id: req.params.id },
        relations: ['rubric', 'publications'],
      })
      res.json(updated)
    } catch (e) {
      console.error('Error updating unit:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Единица не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting unit:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
```

**Step 2:** Заменить роуты — `backend/src/routes/content-unit.routes.ts`:
```ts
import { Router } from 'express'
import { contentUnitController } from '../controllers/content-unit.controller'

const router = Router()

router.get('/', contentUnitController.getAll)
router.get('/:id', contentUnitController.getOne)
router.post('/', contentUnitController.create)
router.put('/:id', contentUnitController.update)
router.delete('/:id', contentUnitController.delete)

export default router
```

(Все legacy-роуты удалены: `/sync-yadisk`, `/export-sheets`, `/:id/publish-youtube`, `/:id/mark-published` — их больше нет.)

**Step 3:** Backend typecheck:
```bash
cd backend && npx tsc --noEmit
```
Expected: чистая сборка (или только pre-existing ошибки в `bank-parsers/*`, `telegram-*`, `wb-finance` и т.п. — не связанные с content-bank).

**Step 4:** Commit:
```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-bank): rewrite content-units API as clean CRUD with filters"
```

### Task 3.3: Контроллер + роуты `content-publication.controller.ts`

**Files:**
- Create: `backend/src/controllers/content-publication.controller.ts`
- Create: `backend/src/routes/content-publication.routes.ts`

**Step 1:** Контроллер:
```ts
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'

const repo = AppDataSource.getRepository(ContentPublication)

export const contentPublicationController = {
  async create(req: Request, res: Response) {
    try {
      const item = repo.create(req.body)
      const saved = await repo.save(item)
      res.status(201).json(saved)
    } catch (e: any) {
      console.error('Error creating publication:', e)
      const msg =
        e?.code === '23505'
          ? 'Публикация в этой соцсети уже добавлена'
          : 'Ошибка создания'
      res.status(400).json({ error: msg })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Публикация не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({ where: { id: req.params.id } })
      res.json(updated)
    } catch (e) {
      console.error('Error updating publication:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Публикация не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting publication:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
```

**Step 2:** Роуты:
```ts
import { Router } from 'express'
import { contentPublicationController } from '../controllers/content-publication.controller'

const router = Router()

router.post('/', contentPublicationController.create)
router.put('/:id', contentPublicationController.update)
router.delete('/:id', contentPublicationController.delete)

export default router
```

**Step 3:** Зарегистрировать в `index.ts`:
```ts
import contentPublicationRoutes from './routes/content-publication.routes'
// ...
app.use('/api/content-publications', contentPublicationRoutes)
```

**Step 4:** Backend typecheck — должен быть чистым (по части content-bank).

**Step 5:** Commit:
```bash
git add backend/src/controllers/content-publication.controller.ts backend/src/routes/content-publication.routes.ts backend/src/index.ts
git commit -m "feat(content-bank): add content-publications CRUD API"
```

### Task 3.4: Smoke-проверка backend локально

**Files:** —

**Step 1:** Запустить backend локально, накатать миграцию вручную на dev-БД (если есть локальная) или на отдельной schema в Supabase. Если локальной БД нет — пропустить, проверим в Stage 8.

**Step 2:** `curl` smoke-проверка пустых эндпоинтов:
```bash
curl -s http://localhost:3001/api/content-rubrics -H "Authorization: Bearer <dev-token>" | jq .
curl -s http://localhost:3001/api/content-units    -H "Authorization: Bearer <dev-token>" | jq .
```
Expected: `[]` для rubrics и `{data: [], pagination: {total: 0, ...}}` для units.

**Step 3:** Этот шаг **без коммита** — это только smoke. Если что-то сломано — фиксить и коммитить отдельно.

---

## Stage 4 — Backend: seed-скрипт

### Task 4.1: Seed-скрипт `seed-content-bank.ts`

**Files:**
- Create: `backend/src/seeds/seed-content-bank.ts`

**Step 1:** Записать:
```ts
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { ContentRubric } from '../entities/ContentRubric'
import { ContentUnit, ContentStatus } from '../entities/ContentUnit'
import seedJson from './data/chemichka_content_bank.json'

interface SeedRubric {
  id: number
  slug: string
  title: string
  emoji: string
  tone: string
  audience: string
  cta_template: string
}

interface SeedIdea {
  id: number
  rubric_id: number
  status: string
  complexity: number
  hook: string
  hook_ab: string
  visual: string
  essence: string
  notes: string | null
}

async function main() {
  await AppDataSource.initialize()
  const rubricRepo = AppDataSource.getRepository(ContentRubric)
  const unitRepo = AppDataSource.getRepository(ContentUnit)

  const rubrics = seedJson.rubrics as SeedRubric[]
  const ideas = seedJson.ideas as SeedIdea[]

  // 1. Find admin user for created_by
  const result = await AppDataSource.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
  )
  const adminId = result[0]?.id
  if (!adminId) {
    throw new Error('No admin user found — cannot set created_by. Create an admin user first.')
  }
  console.log(`Using admin user_id=${adminId} as created_by`)

  // 2. Seed rubrics
  let rubricsCreated = 0
  const slugToId = new Map<string, string>()
  for (const r of rubrics) {
    let existing = await rubricRepo.findOne({ where: { slug: r.slug } })
    if (existing) {
      slugToId.set(r.slug, existing.id)
      continue
    }
    const created = await rubricRepo.save(
      rubricRepo.create({
        slug: r.slug,
        title: r.title,
        emoji: r.emoji,
        tone: r.tone,
        audience: r.audience,
        cta_template: r.cta_template,
        sort_order: r.id,
      }),
    )
    slugToId.set(r.slug, created.id)
    rubricsCreated++
  }
  console.log(`Rubrics: ${rubricsCreated} created, ${rubrics.length - rubricsCreated} skipped`)

  // 3. Seed ideas
  // Map JSON rubric_id (1..6) → slug → uuid
  const seedRubricIdToSlug = new Map<number, string>()
  for (const r of rubrics) seedRubricIdToSlug.set(r.id, r.slug)

  let unitsCreated = 0
  for (const idea of ideas) {
    const slug = seedRubricIdToSlug.get(idea.rubric_id)
    if (!slug) {
      console.warn(`Skipping idea ${idea.id} — unknown rubric_id ${idea.rubric_id}`)
      continue
    }
    const rubricUuid = slugToId.get(slug)!

    // Skip if duplicate (rubric_id, hook)
    const existing = await unitRepo.findOne({ where: { rubric_id: rubricUuid, hook: idea.hook } })
    if (existing) continue

    const title = idea.hook.length > 80 ? idea.hook.slice(0, 80) : idea.hook
    await unitRepo.save(
      unitRepo.create({
        rubric_id: rubricUuid,
        content_type: 'short_video',
        status: idea.status as ContentStatus,
        complexity: idea.complexity,
        title,
        hook: idea.hook,
        hook_ab: idea.hook_ab,
        visual: idea.visual,
        essence: idea.essence,
        notes: idea.notes,
        video_url: null,
        created_by: adminId,
      }),
    )
    unitsCreated++
  }
  console.log(`Units: ${unitsCreated} created, ${ideas.length - unitsCreated} skipped`)

  await AppDataSource.destroy()
  console.log('Done.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

**Step 2:** Добавить script в `backend/package.json`:
```json
"scripts": {
  ...
  "seed:content-bank": "ts-node src/seeds/seed-content-bank.ts"
}
```

**Step 3:** Если в `tsconfig.json` нет `resolveJsonModule: true` — добавить, чтобы импорт JSON работал:
```bash
grep "resolveJsonModule" backend/tsconfig.json
```
Если пусто — открыть `backend/tsconfig.json` и в `compilerOptions` добавить `"resolveJsonModule": true, "esModuleInterop": true`.

**Step 4:** Backend typecheck:
```bash
cd backend && npx tsc --noEmit
```
Expected: чистая сборка по seed-файлу.

**Step 5:** Commit:
```bash
git add backend/src/seeds/seed-content-bank.ts backend/package.json backend/tsconfig.json
git commit -m "feat(content-bank): seed script — 6 rubrics + 95 ideas from JSON"
```

### Task 4.2: Smoke-проверка seed локально (если есть dev-БД)

**Files:** —

**Step 1:** Накатать миграцию на dev-БД:
```bash
psql $DEV_DATABASE_URL -f backend/src/migrations/2026-05-07-content-bank.sql
```
(Или через Supabase SQL-консоль на dev-инстансе.)

**Step 2:** Запустить seed:
```bash
cd backend && npm run seed:content-bank
```
Expected output: `Rubrics: 6 created, 0 skipped`, `Units: 95 created, 0 skipped`, `Done.`

**Step 3:** Проверить, что повторный запуск идемпотентный:
```bash
npm run seed:content-bank
```
Expected: `Rubrics: 0 created, 6 skipped`, `Units: 0 created, 95 skipped`.

**Step 4:** Если что-то сломано — починить отдельным коммитом. Если всё работает — без коммита.

---

## Stage 5 — Frontend: foundation

### Task 5.1: `lib/networks.ts`

**Files:**
- Create: `frontend/src/lib/networks.ts`

**Step 1:** Записать:
```ts
import { Youtube, Instagram, Send, X as XIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export interface NetworkDef {
  value: string
  label: string
  color: string
  icon: ComponentType<SVGProps<SVGSVGElement>> | null
}

export const KNOWN_NETWORKS: NetworkDef[] = [
  { value: 'youtube',   label: 'YouTube',     color: '#FF0000', icon: Youtube },
  { value: 'instagram', label: 'Instagram',   color: '#E4405F', icon: Instagram },
  { value: 'tiktok',    label: 'TikTok',      color: '#000000', icon: null },
  { value: 'telegram',  label: 'Telegram',    color: '#0088CC', icon: Send },
  { value: 'vk',        label: 'VK',          color: '#0077FF', icon: null },
  { value: 'twitter',   label: 'X / Twitter', color: '#000000', icon: XIcon },
]

const byValue = new Map(KNOWN_NETWORKS.map((n) => [n.value, n]))

export function getNetworkDef(value: string): NetworkDef {
  return (
    byValue.get(value) || {
      value,
      label: value,
      color: '#9F95B0',
      icon: null,
    }
  )
}
```

(TikTok и VK без иконок lucide — будут текстовыми чипами. Если хочется — позже добавим SVG-кастомы.)

**Step 2:** Commit:
```bash
git add frontend/src/lib/networks.ts
git commit -m "feat(content-bank): KNOWN_NETWORKS lib + getNetworkDef helper"
```

### Task 5.2: API-модуль `api/contentBank.ts`

**Files:**
- Create: `frontend/src/api/contentBank.ts`

**Step 1:** Записать:
```ts
import { apiClient } from './client'

export type ContentType = 'short_video' | 'text_post' | 'other'

export type ContentStatus =
  | 'idea'
  | 'script'
  | 'filming'
  | 'editing'
  | 'ready'
  | 'published'
  | 'rejected'

export interface ContentRubric {
  id: string
  slug: string
  title: string
  emoji: string | null
  tone: string | null
  audience: string | null
  cta_template: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentPublication {
  id: string
  content_unit_id: string
  network: string
  scheduled_at: string | null
  published_at: string | null
  published_url: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentUnit {
  id: string
  rubric_id: string | null
  rubric: ContentRubric | null
  content_type: ContentType
  status: ContentStatus
  complexity: number | null
  title: string
  hook: string | null
  hook_ab: string | null
  visual: string | null
  essence: string | null
  notes: string | null
  video_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  publications: ContentPublication[]
}

export interface UnitsListParams {
  status?: string         // CSV
  rubric_id?: string      // CSV
  content_type?: string   // CSV
  network?: string        // CSV
  search?: string
  sort?: 'created_at' | 'title' | 'status'
  page?: number
  limit?: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface UnitsListResponse {
  data: ContentUnit[]
  pagination: PaginationMeta
}

// === Rubrics ===
export const rubricsApi = {
  getAll: async (): Promise<ContentRubric[]> => {
    const r = await apiClient.get<ContentRubric[]>('/content-rubrics')
    return r.data
  },
  create: async (data: Partial<ContentRubric>): Promise<ContentRubric> => {
    const r = await apiClient.post<ContentRubric>('/content-rubrics', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentRubric>): Promise<ContentRubric> => {
    const r = await apiClient.put<ContentRubric>(`/content-rubrics/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-rubrics/${id}`)
  },
}

// === Units ===
export const unitsApi = {
  list: async (params: UnitsListParams = {}): Promise<UnitsListResponse> => {
    const r = await apiClient.get<UnitsListResponse>('/content-units', { params })
    return r.data
  },
  getOne: async (id: string): Promise<ContentUnit> => {
    const r = await apiClient.get<ContentUnit>(`/content-units/${id}`)
    return r.data
  },
  create: async (data: Partial<ContentUnit>): Promise<ContentUnit> => {
    const r = await apiClient.post<ContentUnit>('/content-units', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentUnit>): Promise<ContentUnit> => {
    const r = await apiClient.put<ContentUnit>(`/content-units/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-units/${id}`)
  },
}

// === Publications ===
export const publicationsApi = {
  create: async (data: Partial<ContentPublication>): Promise<ContentPublication> => {
    const r = await apiClient.post<ContentPublication>('/content-publications', data)
    return r.data
  },
  update: async (id: string, data: Partial<ContentPublication>): Promise<ContentPublication> => {
    const r = await apiClient.put<ContentPublication>(`/content-publications/${id}`, data)
    return r.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content-publications/${id}`)
  },
}

// === Status / Type metadata for UI ===

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: '💡 идея',
  script: '📝 сценарий',
  filming: '🎬 снимаем',
  editing: '✂️ монтируем',
  ready: '✅ готово',
  published: '🚀 опубликовано',
  rejected: '❌ отказ',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  short_video: '🎬 Ролик',
  text_post: '📝 Текст',
  other: 'Прочее',
}

export const COMPLEXITY_LABELS: Record<number, string> = {
  1: '⭐ просто',
  2: '⭐⭐ средне',
  3: '⭐⭐⭐ сложно',
}
```

**Step 2:** Commit:
```bash
git add frontend/src/api/contentBank.ts
git commit -m "feat(content-bank): frontend API module + status/type/complexity labels"
```

### Task 5.3: Удалить старый `api/contentUnits.ts` и переименовать роут

**Files:**
- Delete: `frontend/src/api/contentUnits.ts`
- Modify: `frontend/src/App.tsx` — lazy-import + Navigate redirect
- Modify: `frontend/src/components/Layout.tsx` — переименовать пункт сайдбара

**Step 1:** Удалить файл:
```bash
rm frontend/src/api/contentUnits.ts
```

Это сломает компиляцию `pages/ContentUnits.tsx`, потому что он импортирует `contentUnitsApi`. Нормально — мы и так этот файл будем удалять следующей задачей. Пока компиляция фронта сломана.

**Step 2:** В `frontend/src/App.tsx`:
- Найти строку `const ContentUnits = lazy(() => import('./pages/ContentUnits'))`. Заменить на `const ContentBank = lazy(() => import('./pages/ContentBank'))`.
- Найти роут `<Route path="/content-units" element={<ContentUnits />} />`. Заменить на:
```tsx
<Route path="/content-bank" element={<ContentBank />} />
<Route path="/content-units" element={<Navigate to="/content-bank" replace />} />
```

(Импорт `Navigate` уже добавлен в Commit 80d613c — проверить, что есть в imports.)

**Step 3:** В `frontend/src/components/Layout.tsx`:
- Найти пункт `{ type: 'link', name: 'Контентные единицы', href: '/content-units', icon: ... }` (грепом по `'Контентные единицы'`).
- Заменить `name: 'Контентные единицы'` → `name: 'Контент-банк'`.
- Заменить `href: '/content-units'` → `href: '/content-bank'`.

**Step 4:** Backend будет компилироваться. Frontend пока сломан (нет `pages/ContentBank.tsx`) — починим в Stage 6. Коммитим как промежуточное состояние:
```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/api/contentUnits.ts frontend/src/pages/ContentUnits.tsx
git commit -m "feat(content-bank): rename route + sidebar entry, drop old api/contentUnits"
```

(`pages/ContentUnits.tsx` тоже идёт в коммит как удаляемый файл — заменим на `ContentBank.tsx` в Stage 6.)

```bash
rm frontend/src/pages/ContentUnits.tsx
git add frontend/src/pages/ContentUnits.tsx
git commit --amend --no-edit
```

(Альтернатива — не удалять сейчас, оставить «битый» импорт и грохнуть в одном коммите со Stage 6. На вкус.)

---

## Stage 6 — Frontend: страница ContentBank с фильтрами и таблицей

### Task 6.1: Скелет `pages/ContentBank.tsx` — пустая страница, грузит и показывает таблицу

**Files:**
- Create: `frontend/src/pages/ContentBank.tsx`

**Step 1:** Минимальная версия — только список без фильтров, чтобы быстро увидеть данные:
```tsx
import { useState, useEffect, useCallback } from 'react'
import { Plus, Settings } from 'lucide-react'
import { unitsApi, ContentUnit, STATUS_LABELS, CONTENT_TYPE_LABELS } from '../api/contentBank'
import { useToast } from '../contexts/ToastContext'

export default function ContentBank() {
  const toast = useToast()
  const [items, setItems] = useState<ContentUnit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await unitsApi.list({ limit: 200 })
      setItems(r.data)
      setTotal(r.pagination.total)
    } catch {
      toast.error('Ошибка загрузки контент-банка')
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-brand-text">Контент-банк</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex items-center gap-2">
            <Settings size={16} />
            <span className="hidden sm:inline">Рубрики</span>
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus size={16} />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-brand-text-secondary">Нет единиц контента</div>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Рубрика
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Статус
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary whitespace-nowrap">
                    Тип
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">
                    Название / Hook
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-brand-text-secondary">Сети</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-brand-border hover:bg-subtle">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.rubric ? (
                        <span>
                          {u.rubric.emoji} {u.rubric.title}
                        </span>
                      ) : (
                        <span className="text-brand-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {STATUS_LABELS[u.status]}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      {CONTENT_TYPE_LABELS[u.content_type]}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-brand-text max-w-[400px] truncate">
                        {u.title}
                      </div>
                      {u.hook && u.hook !== u.title && (
                        <div className="text-xs text-brand-text-secondary max-w-[400px] truncate">
                          {u.hook}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.publications.map((p) => (
                          <span
                            key={p.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-subtle text-brand-text-secondary"
                          >
                            {p.network}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-brand-border text-xs text-brand-text-secondary">
            Показано {items.length} из {total}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2:** Frontend typecheck:
```bash
cd frontend && npx tsc --noEmit
```
Expected: pre-existing ошибки не в наших файлах.

**Step 3:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): minimal ContentBank page — table view of units"
```

### Task 6.2: Добавить фильтры (тип, рубрика, сети, статус) с URL-state

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx`

**Step 1:** Расширить страницу — поверх предыдущей версии:
- Импорты: `useSearchParams` из `react-router-dom`, `STATUS_LABELS`, `CONTENT_TYPE_LABELS`, `rubricsApi`, `KNOWN_NETWORKS`
- State для рубрик: `const [rubrics, setRubrics] = useState<ContentRubric[]>([])` + загрузка в useEffect
- Фильтры читаются из `searchParams`, изменения — через `setSearchParams`
- Multi-select chip-bar для каждого: тип, рубрика, сети, статус
- Поиск-input с debounce (timeout-based)
- При смене фильтров — `unitsApi.list({...filtersFromUrl})` пере-фетчится

Конкретный код длинный (~150 строк) — здесь дам шаблон chip-фильтра как референс, остальное по этому образцу:
```tsx
function FilterChipBar<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const toggle = (v: T) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-brand-text-secondary w-20 shrink-0">{label}:</span>
      <button
        onClick={() => onChange([])}
        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
          selected.length === 0
            ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
        }`}
      >
        Все
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            selected.includes(o.value)
              ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 text-primary-700'
              : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

URL-state читается так:
```ts
const statusList = (searchParams.get('status') || '').split(',').filter(Boolean) as ContentStatus[]
// updates:
const updateStatus = (next: ContentStatus[]) => {
  const sp = new URLSearchParams(searchParams)
  if (next.length === 0) sp.delete('status')
  else sp.set('status', next.join(','))
  setSearchParams(sp)
}
```

И в `unitsApi.list({...})` — передаём CSV-строки прямо из `searchParams`.

**Step 2:** Smoke вручную: открыть `/content-bank`, нажать чип «📝 сценарий» — список должен отфильтроваться, URL обновиться на `?status=script`. Перезагрузить страницу — фильтр сохранён.

**Step 3:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): URL-stateful filters by type / rubric / network / status + search"
```

### Task 6.3: Сортировка + пагинация

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx`

**Step 1:** Добавить:
- Dropdown сортировки в шапку (опции: «новые» / «алфавит» / «по статусу»). Хранится в `searchParams.get('sort')`.
- Пагинация (Prev/Next + номера страниц), как в `Transactions.tsx` — копировать паттерн оттуда. `page` хранится в URL.

**Step 2:** Smoke: накликать страницы, проверить, что URL обновляется, страница работает с фильтрами.

**Step 3:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): sort dropdown + pagination"
```

### Task 6.4: Кнопка-edit в строке + delete

**Files:**
- Modify: `frontend/src/pages/ContentBank.tsx`

**Step 1:** В `<tr>` добавить колонку «Действия»:
```tsx
<td className="py-3 px-4 text-right">
  <div className="flex justify-end gap-1">
    <button
      onClick={() => setEditingUnit(u)}
      className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50"
    >
      <Pencil className="h-4 w-4" />
    </button>
    <button
      onClick={() => handleDelete(u.id)}
      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
</td>
```

`handleDelete` — через `useConfirmDialog`. Edit-модалку оставляем заглушкой (открывается, но пустая) до Stage 7.

**Step 2:** Commit:
```bash
git add frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): per-row edit/delete actions + confirm dialog"
```

---

## Stage 7 — Frontend: edit-модалка + RubricsManager

### Task 7.1: `StatusPicker.tsx` — переключатель из 7 пилюль

**Files:**
- Create: `frontend/src/components/content-bank/StatusPicker.tsx`

**Step 1:** Записать:
```tsx
import { ContentStatus, STATUS_LABELS } from '../../api/contentBank'

const FLOW_ORDER: ContentStatus[] = ['idea', 'script', 'filming', 'editing', 'ready', 'published']
const REJECTED: ContentStatus = 'rejected'

interface Props {
  value: ContentStatus
  onChange: (s: ContentStatus) => void
}

export function StatusPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {FLOW_ORDER.map((s, i) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              value === s
                ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-400 text-primary-700'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <button
        onClick={() => onChange(REJECTED)}
        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
          value === REJECTED
            ? 'bg-red-100 border-red-400 text-red-700'
            : 'bg-card border-brand-border text-brand-text-secondary hover:border-red-300'
        }`}
      >
        {STATUS_LABELS[REJECTED]}
      </button>
    </div>
  )
}
```

**Step 2:** Commit:
```bash
git add frontend/src/components/content-bank/StatusPicker.tsx
git commit -m "feat(content-bank): StatusPicker — 6-stage flow + rejected"
```

### Task 7.2: `NetworkChips.tsx` — селектор сетей (KNOWN + custom)

**Files:**
- Create: `frontend/src/components/content-bank/NetworkChips.tsx`

**Step 1:** Записать (компонент работает для фильтров и для PublicationsEditor):
```tsx
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { KNOWN_NETWORKS, getNetworkDef } from '../../lib/networks'

interface Props {
  selected: string[]
  onChange: (next: string[]) => void
  allowCustom?: boolean
  size?: 'sm' | 'md'
}

export function NetworkChips({ selected, onChange, allowCustom = true, size = 'md' }: Props) {
  const [adding, setAdding] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }

  const addCustom = () => {
    const v = customValue.trim().toLowerCase()
    if (v && !selected.includes(v)) onChange([...selected, v])
    setCustomValue('')
    setAdding(false)
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  // Show: known networks as chips, plus any custom values from `selected` not in KNOWN
  const customSelected = selected.filter((s) => !KNOWN_NETWORKS.find((k) => k.value === s))

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {KNOWN_NETWORKS.map((n) => {
        const active = selected.includes(n.value)
        return (
          <button
            key={n.value}
            onClick={() => toggle(n.value)}
            className={`${px} rounded-full border transition-colors flex items-center gap-1 ${
              active
                ? 'border-primary-400 text-white'
                : 'bg-card border-brand-border text-brand-text-secondary hover:border-primary-300'
            }`}
            style={active ? { backgroundColor: n.color } : undefined}
          >
            {n.icon ? <n.icon width={12} height={12} /> : null}
            {n.label}
          </button>
        )
      })}
      {customSelected.map((v) => {
        const def = getNetworkDef(v)
        return (
          <span
            key={v}
            className={`${px} rounded-full border bg-subtle border-brand-border text-brand-text-secondary flex items-center gap-1`}
          >
            {def.label}
            <button onClick={() => toggle(v)} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        )
      })}
      {allowCustom && (
        adding ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              onBlur={addCustom}
              placeholder="свой тег"
              className={`${px} rounded-full border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 max-w-[100px]`}
            />
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={`${px} rounded-full border border-dashed border-brand-border text-brand-text-secondary hover:border-primary-400 flex items-center gap-1`}
          >
            <Plus size={10} /> свой тег
          </button>
        )
      )}
    </div>
  )
}
```

**Step 2:** Commit:
```bash
git add frontend/src/components/content-bank/NetworkChips.tsx
git commit -m "feat(content-bank): NetworkChips — KNOWN_NETWORKS multi-select + custom tags"
```

### Task 7.3: `PublicationsEditor.tsx` — секция «Публикации» в edit-модалке

**Files:**
- Create: `frontend/src/components/content-bank/PublicationsEditor.tsx`

**Step 1:** Записать (~150 строк):
```tsx
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  ContentPublication,
  publicationsApi,
} from '../../api/contentBank'
import { getNetworkDef, KNOWN_NETWORKS } from '../../lib/networks'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  unitId: string
  publications: ContentPublication[]
  onChange: (next: ContentPublication[]) => void
}

export function PublicationsEditor({ unitId, publications, onChange }: Props) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newNetwork, setNewNetwork] = useState('')

  const addPublication = async (network: string) => {
    if (!network) return
    if (publications.find((p) => p.network === network)) {
      toast.error('Эта соцсеть уже добавлена')
      return
    }
    try {
      const created = await publicationsApi.create({
        content_unit_id: unitId,
        network,
      })
      onChange([...publications, created])
      setAdding(false)
      setNewNetwork('')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка добавления')
    }
  }

  const updateField = async (
    pub: ContentPublication,
    patch: Partial<ContentPublication>,
  ) => {
    // Optimistic update
    const next = publications.map((p) => (p.id === pub.id ? { ...p, ...patch } : p))
    onChange(next)
    try {
      await publicationsApi.update(pub.id, patch)
    } catch {
      toast.error('Ошибка сохранения')
      onChange(publications) // rollback
    }
  }

  const remove = async (pub: ContentPublication) => {
    if (!confirm(`Удалить публикацию в ${getNetworkDef(pub.network).label}?`)) return
    try {
      await publicationsApi.delete(pub.id)
      onChange(publications.filter((p) => p.id !== pub.id))
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  const availableNetworks = KNOWN_NETWORKS.filter(
    (n) => !publications.find((p) => p.network === n.value),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-brand-text">Публикации</h4>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs px-2 py-1 rounded-lg border border-brand-border text-primary-600 hover:border-primary-400"
          >
            + Добавить публикацию
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-subtle p-3 rounded-xl space-y-2">
          <p className="text-xs text-brand-text-secondary">Выбери соцсеть или введи свою:</p>
          <div className="flex gap-1 flex-wrap">
            {availableNetworks.map((n) => (
              <button
                key={n.value}
                onClick={() => addPublication(n.value)}
                className="px-2.5 py-1 text-xs rounded-full border border-brand-border bg-card hover:border-primary-300"
              >
                {n.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newNetwork}
              onChange={(e) => setNewNetwork(e.target.value)}
              placeholder="свой тег (threads, zen…)"
              className="text-xs px-3 py-1.5 rounded-xl border border-brand-border bg-card flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addPublication(newNetwork.trim().toLowerCase())}
            />
            <button
              onClick={() => addPublication(newNetwork.trim().toLowerCase())}
              disabled={!newNetwork.trim()}
              className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-xl disabled:opacity-40"
            >
              Добавить
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setNewNetwork('')
              }}
              className="text-xs px-3 py-1.5 text-brand-text-secondary"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {publications.map((p) => {
        const def = getNetworkDef(p.network)
        return (
          <div
            key={p.id}
            className="bg-card border border-brand-border rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: def.color }}
              >
                {def.icon ? <def.icon className="inline w-3 h-3 mr-1" /> : null}
                {def.label}
              </span>
              <button
                onClick={() => remove(p)}
                className="p-1 text-brand-text-secondary hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-brand-text-secondary">Запланировано</label>
                <input
                  type="datetime-local"
                  value={p.scheduled_at ? p.scheduled_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateField(p, {
                      scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-text-secondary">Опубликовано</label>
                <input
                  type="datetime-local"
                  value={p.published_at ? p.published_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateField(p, {
                      published_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-brand-text-secondary">Ссылка на пост</label>
              <input
                type="url"
                value={p.published_url || ''}
                onChange={(e) => updateField(p, { published_url: e.target.value || null })}
                placeholder="https://..."
                className="text-xs w-full px-2 py-1.5 rounded-lg border border-brand-border bg-subtle"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2:** Commit:
```bash
git add frontend/src/components/content-bank/PublicationsEditor.tsx
git commit -m "feat(content-bank): PublicationsEditor — add/edit/delete per-network publications"
```

### Task 7.4: `UnitEditModal.tsx` — модалка create/edit (через portal)

**Files:**
- Create: `frontend/src/components/content-bank/UnitEditModal.tsx`
- Modify: `frontend/src/pages/ContentBank.tsx` — подключить модалку

**Step 1:** Записать модалку (~250 строк):
- Через `createPortal(..., document.body)`.
- Шапка: title (Новая / Редактировать), кнопка X (close).
- Поля: тип (radio), рубрика (select с tone-подсказкой справа), StatusPicker, complexity (3 кнопки звёздочек), title (input), conditional блок (hook/hook_ab/visual/essence для short_video; «тело поста» для text_post; всё видно для other), video_url, notes, PublicationsEditor (только если редактируем существующий unit — у нового нет id для FK).
- Подвал: «Отмена» + «Сохранить» (POST если новый, PUT если существующий).
- При создании нового — после save вернуться к editing-mode для возможности добавить публикации.

(Полный код длинный — паттерн как в `TransactionModal.tsx` + `BankImportModal.tsx`. Если стоп — здесь скелет, executor добивает.)

**Step 2:** В `ContentBank.tsx`: state `editingUnit: ContentUnit | null | 'new'`, `setEditingUnit('new')` при клике «+ Добавить», `setEditingUnit(unit)` при edit-кнопке. На модалке — `onClose` reload list.

**Step 3:** Smoke вручную: создать новую единицу → отображается в таблице. Редактировать существующую → изменения сохраняются.

**Step 4:** Commit:
```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): UnitEditModal — create/edit with conditional fields by type"
```

### Task 7.5: `RubricsManagerModal.tsx` — управление рубриками

**Files:**
- Create: `frontend/src/components/content-bank/RubricsManagerModal.tsx`
- Modify: `frontend/src/pages/ContentBank.tsx` — кнопка «⚙ Рубрики» открывает модалку

**Step 1:** Модалка через portal: список рубрик (sort_order, edit/delete inline), кнопка «+ Добавить» открывает under-modal с формой (slug, title, emoji, tone, audience, cta_template).

(Скелет аналогичен предыдущим модалкам.)

**Step 2:** Smoke: создать новую рубрику → она появляется в фильтре «Рубрика» на главной. Удалить рубрику с привязанной единицей → confirm → единица становится «Без рубрики».

**Step 3:** Commit:
```bash
git add frontend/src/components/content-bank/RubricsManagerModal.tsx frontend/src/pages/ContentBank.tsx
git commit -m "feat(content-bank): RubricsManagerModal — full CRUD for rubrics"
```

---

## Stage 8 — Migration & deploy

### Task 8.1: Frontend и backend локально проходят typecheck + build

**Files:** —

**Step 1:**
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```
Expected: чистая сборка фронта; на бэке — только pre-existing ошибки в other модулях.

Если что-то сломано в content-bank-коде — фиксить и коммитить отдельно перед миграцией.

### Task 8.2: Backup БД на проде

**Files:** —

**Step 1:** Через Supabase Dashboard → Database → Backups — либо взять существующий automated backup, либо запустить manual snapshot.

**Step 2:** Дополнительно — `pg_dump` через локальный psql в файл:
```bash
pg_dump $PROD_DATABASE_URL > backup-before-content-bank-$(date +%Y%m%d-%H%M).sql
```

**Step 3:** Без коммита.

### Task 8.3: Накатать SQL-миграцию на прод

**Files:** —

**Step 1:** Открыть Supabase Dashboard → SQL Editor.

**Step 2:** Скопировать содержимое `backend/src/migrations/2026-05-07-content-bank.sql` в редактор и запустить.

**Step 3:** Проверить:
```sql
SELECT count(*) FROM content_rubrics;        -- 0
SELECT count(*) FROM content_units;          -- 0
SELECT count(*) FROM content_publications;   -- 0
```

### Task 8.4: Push в оба remote'а

**Files:** —

**Step 1:**
```bash
git push vercel-deploy main   # фронт на Vercel
git push origin main          # бэк на Railway
```

**Step 2:** Подождать ~2-3 минуты пока Vercel и Railway соберут и развернут. Vercel-деплой — через MCP-tool `list_deployments` (теребить пока state не станет `READY`). Railway — открыть logs.

### Task 8.5: Запустить seed на проде через Railway shell

**Files:** —

**Step 1:** Открыть Railway → проект → Service → Deployments → последний деплой → кнопка `…` → `Open Shell` (или через `railway run`).

**Step 2:**
```bash
npm run seed:content-bank
```
Expected: `Rubrics: 6 created, 0 skipped`, `Units: 95 created, 0 skipped`.

**Step 3:** Проверить через psql:
```sql
SELECT count(*) FROM content_rubrics;      -- 6
SELECT count(*) FROM content_units;        -- 95
SELECT slug, title FROM content_rubrics ORDER BY sort_order;
```

### Task 8.6: Финальный smoke на erp.ximi4ka.ru

**Files:** —

**Step 1:** Hard refresh `https://erp.ximi4ka.ru/content-bank`.

**Step 2:** Прогон:
- Сайдбар: пункт «Контент-банк» вместо «Контентные единицы», ведёт на `/content-bank`.
- Таблица показывает 95 строк, все в статусе `idea`, все типа `🎬 Ролик`.
- Старый URL `/content-units` редиректит на `/content-bank`.
- Фильтр «Рубрика → Как разбогатеть на химии» — отдает 25 строк.
- Фильтр «Сложность» — Wait, сложности в фильтрах нет (я не добавил). OK.
- Создать новую единицу типа «Текст» → поля переключаются → save → строка появляется в таблице.
- Открыть существующую единицу → добавить публикацию в `youtube` → выставить scheduled_at → save → перезагрузить → дата сохранилась.
- Удалить рубрику без units → success. Удалить рубрику с units → confirm → units получают `rubric_id=NULL`.

**Step 3:** Если всё работает — финал. Если что-то сломано — фиксить отдельным hotfix-коммитом + push в оба remote'а.

---

## Completion Criteria

- ✅ Все 30 задач выполнены и закоммичены.
- ✅ TypeScript-сборка backend (по части content-bank) и frontend — чистые.
- ✅ Миграция накатана на прод, seed загружен (6 rubrics + 95 units).
- ✅ erp.ximi4ka.ru/content-bank работает: фильтры, создание, редактирование, публикации, рубрики CRUD.
- ✅ Старый URL `/content-units` редиректится на `/content-bank`.
- ✅ Все три legacy-интеграции (YaDisk, Sheets, YouTube) удалены без следов в коде.
