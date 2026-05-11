# Marketing Unit — Phase A (Foundation) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** ✅ Phase A complete on 2026-05-12. Ready for Phase B (Strategy + Channels UI).

**Goal:** Заложить schema-фундамент Marketing-юнита: 6 новых таблиц, 4 новых поля в `content_units`, миграцию `content_publications.network` (string) → `channel_id` (FK), без изменения UX и без поломки текущего short_video pipeline.

**Architecture:** Чистая backend-only фаза. Все изменения — это (1) raw SQL migration файл, применяемый вручную в Supabase до деплоя, (2) новые TypeORM entities + расширение существующих, (3) seed для начальных каналов, (4) regression-smoke через существующие endpoints. UX не трогаем.

**Tech Stack:** PostgreSQL (Supabase), TypeORM 0.3.x, TypeScript, Node.js + Express. Без тестового фреймворка — verification через `npm run build`, ручные curl-проверки и SQL-запросы.

**Parent docs:**
- Operating model: [2026-05-11-marketing-unit-operating-model-design.md](2026-05-11-marketing-unit-operating-model-design.md)
- Content production PRD: [2026-05-11-content-production-prd-design.md](2026-05-11-content-production-prd-design.md) — см. §8 Phase A.

---

## Pre-flight checklist (до начала Task 1)

1. Подтверди, что находишься в worktree (рабочее дерево уже создано):
   ```bash
   pwd
   ```
   Ожидается путь, содержащий `.claude/worktrees/`.

2. Проверь, что backend компилируется в исходном состоянии:
   ```bash
   cd backend && npm run build && cd ..
   ```
   Ожидается успех без ошибок. Это baseline — каждый последующий шаг сравнивается с ним.

3. Открой [PRD §4](2026-05-11-content-production-prd-design.md) (Модель данных — эволюция) в соседней вкладке как справочник по полям.

---

## Task 1: SQL migration — create 6 new tables + alter 2 existing

**Files:**
- Create: `backend/src/migrations/2026-05-11-marketing-phase-a.sql`

**Context:** Все DDL для фазы A в одном файле. Применяется через Supabase SQL Editor **до** деплоя backend-кода. Все ALTER — идемпотентные (`IF NOT EXISTS`); все CREATE — внутри `BEGIN/COMMIT`. После этого Task TypeORM-entities в коде смогут читать/писать новые поля без `synchronize`.

**Step 1: Write the migration file**

Create `backend/src/migrations/2026-05-11-marketing-phase-a.sql`:

```sql
-- 2026-05-11 Marketing Phase A — schema foundation
-- Apply in Supabase SQL Editor BEFORE deploying backend code.
-- All operations idempotent / safe to re-run.

BEGIN;

-- =========================================================
-- 1. icp_segment — strategic ICP taxonomy
-- =========================================================
CREATE TABLE IF NOT EXISTS icp_segment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(80) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  age_range   VARCHAR(50),
  role        VARCHAR(80),
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_icp_segment_active ON icp_segment (active);

-- =========================================================
-- 2. strategic_theme — quarterly themes
-- =========================================================
CREATE TABLE IF NOT EXISTS strategic_theme (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         VARCHAR(80) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  active_from  DATE,
  active_to    DATE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strategic_theme_active
  ON strategic_theme (active_from, active_to);

-- =========================================================
-- 3. channel — first-class publishing channels
-- =========================================================
CREATE TABLE IF NOT EXISTS channel (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                VARCHAR(80) UNIQUE NOT NULL,
  display_name        VARCHAR(200) NOT NULL,
  platform            VARCHAR(40) NOT NULL,
  account_handle      VARCHAR(120),
  profile_url         VARCHAR(500),
  integration_status  VARCHAR(20) NOT NULL DEFAULT 'manual',
  active              BOOLEAN NOT NULL DEFAULT true,
  config_json         JSONB,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_platform ON channel (platform);
CREATE INDEX IF NOT EXISTS idx_channel_active ON channel (active);

-- =========================================================
-- 4. channel_budget — period budgets per channel
-- =========================================================
CREATE TABLE IF NOT EXISTS channel_budget (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  amount_rub    NUMERIC(14, 2) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_channel_budget_channel ON channel_budget (channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_budget_period
  ON channel_budget (period_start, period_end);

-- =========================================================
-- 5. content_asset — production artifacts
-- =========================================================
CREATE TABLE IF NOT EXISTS content_asset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_unit_id UUID NOT NULL REFERENCES content_units(id) ON DELETE CASCADE,
  recipe_step_id  VARCHAR(80),
  kind            VARCHAR(40) NOT NULL,
  storage         VARCHAR(20) NOT NULL,
  path_or_url     TEXT NOT NULL,
  size_bytes      BIGINT,
  mime            VARCHAR(120),
  provider_hint   VARCHAR(40),
  version         INT NOT NULL DEFAULT 1,
  superseded_by   UUID REFERENCES content_asset(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS idx_content_asset_unit ON content_asset (content_unit_id);
CREATE INDEX IF NOT EXISTS idx_content_asset_step ON content_asset (recipe_step_id);
CREATE INDEX IF NOT EXISTS idx_content_asset_kind ON content_asset (kind);

-- =========================================================
-- 6. content_metric_snapshot — per-publication metric snapshots
-- =========================================================
CREATE TABLE IF NOT EXISTS content_metric_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id      UUID NOT NULL REFERENCES content_publications(id) ON DELETE CASCADE,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by         VARCHAR(20) NOT NULL DEFAULT 'manual',
  views               INT,
  likes               INT,
  comments            INT,
  shares              INT,
  saves               INT,
  profile_clicks      INT,
  marketplace_clicks  INT,
  raw_json            JSONB
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_publication
  ON content_metric_snapshot (publication_id);
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_captured
  ON content_metric_snapshot (captured_at DESC);

-- =========================================================
-- 7. content_units — strategy FK + recipe state
-- =========================================================
ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS target_segment_id     UUID REFERENCES icp_segment(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_id              UUID REFERENCES strategic_theme(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_state          JSONB,
  ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_units_segment ON content_units (target_segment_id);
CREATE INDEX IF NOT EXISTS idx_units_theme   ON content_units (theme_id);

-- =========================================================
-- 8. content_publications — channel FK (nullable for now) + publisher fields
-- =========================================================
ALTER TABLE content_publications
  ADD COLUMN IF NOT EXISTS channel_id     UUID REFERENCES channel(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS auto_publish   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publisher_log  JSONB;
CREATE INDEX IF NOT EXISTS idx_publications_channel ON content_publications (channel_id);
-- NOTE: column `network` is NOT dropped here; backfill happens in Task 6,
-- NOT NULL + drop happens in a separate later migration after verification.

COMMIT;
```

**Step 2: Sanity-check the SQL syntax**

```bash
cd backend
npx sql-formatter src/migrations/2026-05-11-marketing-phase-a.sql --language postgresql > /dev/null 2>&1 || true
# If sql-formatter is not installed, just visually scan the file
cd ..
```
Expected: file readable, no obvious typos. If your editor flags syntax errors, fix them.

**Step 3: Apply the migration to Supabase manually**

1. Открой Supabase SQL Editor (project Ximi4ka prod).
2. Скопируй содержимое `backend/src/migrations/2026-05-11-marketing-phase-a.sql`.
3. Запусти. Ожидается: `COMMIT` без ошибок.
4. Verify через query в том же editor:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'icp_segment', 'strategic_theme', 'channel', 'channel_budget',
       'content_asset', 'content_metric_snapshot'
     );
   ```
   Expected: 6 строк.
5. Verify, что `content_units` имеет новые колонки:
   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'content_units'
     AND column_name IN ('target_segment_id', 'theme_id', 'recipe_state', 'production_started_at');
   ```
   Expected: 4 строки.
6. Verify, что `content_publications.channel_id` существует:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'content_publications' AND column_name = 'channel_id';
   ```
   Expected: 1 строка.

**Step 4: Commit the migration file**

```bash
git add backend/src/migrations/2026-05-11-marketing-phase-a.sql
git commit -m "feat(marketing): phase A — schema migration

6 новых таблиц (icp_segment, strategic_theme, channel, channel_budget,
content_asset, content_metric_snapshot), strategy FK + recipe_state в
content_units, channel_id + auto_publish + publisher_log в
content_publications. Применять вручную в Supabase до деплоя кода."
```

---

## Task 2: TypeORM entity — `IcpSegment`

**Files:**
- Create: `backend/src/entities/IcpSegment.ts`

**Context:** Простая lookup-таблица, читается из контент-юнита через FK, редактируется в `/marketing/strategy` (Phase B). Никаких relations на стороне сегмента — ContentUnit получит обратную сторону через `@ManyToOne` в Task 8.

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('icp_segment')
export class IcpSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  age_range: string | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  role: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @Column({ type: 'boolean', default: true })
  active: boolean

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add backend/src/entities/IcpSegment.ts
git commit -m "feat(entities): add IcpSegment"
```

---

## Task 3: TypeORM entity — `StrategicTheme`

**Files:**
- Create: `backend/src/entities/StrategicTheme.ts`

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('strategic_theme')
export class StrategicTheme {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'date', nullable: true })
  active_from: string | null

  @Column({ type: 'date', nullable: true })
  active_to: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

Note: `date` columns в TypeORM по умолчанию маппятся в `string` (формат `YYYY-MM-DD`), не `Date`. Это намеренно — `date` без timezone.

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```

**Step 3: Commit**

```bash
git add backend/src/entities/StrategicTheme.ts
git commit -m "feat(entities): add StrategicTheme"
```

---

## Task 4: TypeORM entity — `Channel`

**Files:**
- Create: `backend/src/entities/Channel.ts`

**Context:** First-class сущность канала публикации. На этой фазе не имеет relations — ContentPublication получит FK на неё в Task 9. `ChannelBudget` будет ссылаться на неё в Task 5.

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { ChannelBudget } from './ChannelBudget'

export type ChannelPlatform =
  | 'telegram'
  | 'tiktok'
  | 'reels'
  | 'youtube'
  | 'youtube_shorts'
  | 'vk'
  | 'x'
  | 'instagram'
  | 'yandex_zen'
  | 'site'
  | 'wb'
  | 'ozon'
  | 'email'
  | 'other'

export type ChannelIntegrationStatus = 'manual' | 'api_connected' | 'api_planned'

@Entity('channel')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 200 })
  display_name: string

  @Column({ type: 'varchar', length: 40 })
  platform: ChannelPlatform

  @Column({ type: 'varchar', length: 120, nullable: true })
  account_handle: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_url: string | null

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  integration_status: ChannelIntegrationStatus

  @Column({ type: 'boolean', default: true })
  active: boolean

  @Column({ type: 'jsonb', nullable: true })
  config_json: Record<string, unknown> | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ChannelBudget, (b) => b.channel)
  budgets: ChannelBudget[]
}
```

**Step 2: Typecheck (expect ChannelBudget unresolved — fix in next task)**

Skip typecheck until Task 5 is done. (Or temporarily stub ChannelBudget import — but cleaner to do tasks in sequence and check after Task 5.)

**Step 3: Commit at end of Task 5**

(No commit yet — Tasks 4 + 5 form a unit because they're mutually dependent.)

---

## Task 5: TypeORM entity — `ChannelBudget`

**Files:**
- Create: `backend/src/entities/ChannelBudget.ts`

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Channel } from './Channel'

@Entity('channel_budget')
export class ChannelBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  channel_id: string

  @ManyToOne(() => Channel, (c) => c.budgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel

  @Column({ type: 'date' })
  period_start: string

  @Column({ type: 'date' })
  period_end: string

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount_rub: string

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

Note: `numeric(14,2)` маппится в `string` в TypeORM (для сохранения precision). Это паттерн всего проекта — см. `WbFinancialStat` и `Supply` для подтверждения.

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0 errors.

**Step 3: Commit Tasks 4+5 together**

```bash
git add backend/src/entities/Channel.ts backend/src/entities/ChannelBudget.ts
git commit -m "feat(entities): add Channel + ChannelBudget"
```

---

## Task 6: TypeORM entity — `ContentAsset`

**Files:**
- Create: `backend/src/entities/ContentAsset.ts`

**Context:** Гибридное хранилище артефактов (см. PRD §4.2). `storage` дискриминатор разделяет supabase-blob и external-url. На этой фазе НЕТ relation на стороне ContentUnit (`@OneToMany`) — добавим в Task 8 одновременно с другими изменениями ContentUnit.

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'

export type ContentAssetKind =
  | 'image'
  | 'audio'
  | 'pdf'
  | 'video_external'
  | 'published_url'
  | 'script_text'
  | 'other'

export type ContentAssetStorage = 'supabase' | 'external'

@Entity('content_asset')
export class ContentAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  content_unit_id: string

  @ManyToOne(() => ContentUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_unit_id' })
  content_unit: ContentUnit

  @Column({ type: 'varchar', length: 80, nullable: true })
  recipe_step_id: string | null

  @Column({ type: 'varchar', length: 40 })
  kind: ContentAssetKind

  @Column({ type: 'varchar', length: 20 })
  storage: ContentAssetStorage

  @Column({ type: 'text' })
  path_or_url: string

  @Column({ type: 'bigint', nullable: true })
  size_bytes: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  mime: string | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  provider_hint: string | null

  @Column({ type: 'int', default: 1 })
  version: number

  @Column({ type: 'uuid', nullable: true })
  superseded_by: string | null

  @CreateDateColumn()
  created_at: Date

  @Column({ type: 'varchar', length: 120, nullable: true })
  created_by: string | null
}
```

Note: `bigint` маппится в `string` в TypeORM (JS не безопасно держит int64). Это нормально — нам нужен только размер для UI и фильтра.

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```

**Step 3: Commit**

```bash
git add backend/src/entities/ContentAsset.ts
git commit -m "feat(entities): add ContentAsset (hybrid storage)"
```

---

## Task 7: TypeORM entity — `ContentMetricSnapshot`

**Files:**
- Create: `backend/src/entities/ContentMetricSnapshot.ts`

**Step 1: Write the entity**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ContentPublication } from './ContentPublication'

export type MetricCapturedBy = 'worker' | 'manual'

@Entity('content_metric_snapshot')
export class ContentMetricSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  publication_id: string

  @ManyToOne(() => ContentPublication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publication_id' })
  publication: ContentPublication

  @CreateDateColumn({ type: 'timestamptz', name: 'captured_at' })
  captured_at: Date

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  captured_by: MetricCapturedBy

  @Column({ type: 'int', nullable: true })
  views: number | null

  @Column({ type: 'int', nullable: true })
  likes: number | null

  @Column({ type: 'int', nullable: true })
  comments: number | null

  @Column({ type: 'int', nullable: true })
  shares: number | null

  @Column({ type: 'int', nullable: true })
  saves: number | null

  @Column({ type: 'int', nullable: true })
  profile_clicks: number | null

  @Column({ type: 'int', nullable: true })
  marketplace_clicks: number | null

  @Column({ type: 'jsonb', nullable: true })
  raw_json: Record<string, unknown> | null
}
```

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```

**Step 3: Commit**

```bash
git add backend/src/entities/ContentMetricSnapshot.ts
git commit -m "feat(entities): add ContentMetricSnapshot"
```

---

## Task 8: Extend `ContentUnit` — content_type enum + strategy FK + recipe_state

**Files:**
- Modify: `backend/src/entities/ContentUnit.ts`

**Context:** Расширяем `ContentType` union до 12 значений. Добавляем relations + nullable поля для strategy + recipe_state. Существующие поля (`script_text`, `video_brief`, `voiceover_text`, `video_url`) **не трогаем** — они работают для short_video pipeline и для legacy-данных.

**Step 1: Replace `ContentType` union**

В начале файла, заменить:

```typescript
export type ContentType = 'short_video' | 'text_post' | 'other'
```

на:

```typescript
export type ContentType =
  | 'short_video'
  | 'long_video'
  | 'stream'
  | 'podcast'
  | 'short_post'
  | 'long_post'
  | 'carousel'
  | 'seo_article'
  | 'email_newsletter'
  | 'lead_magnet_pdf'
  | 'marketplace_card'
  | 'ad_creative'
  // legacy values — kept for backfill compatibility, do not use for new units
  | 'text_post'
  | 'other'
```

Note: `text_post` и `other` оставляем в union, чтобы существующие строки в БД не вызывали TS-ошибок. В сидах и UI мы их не предлагаем для новых юнитов.

**Step 2: Add imports for new entities at top of file**

После строки `import { ContentPublication } from './ContentPublication'`:

```typescript
import { IcpSegment } from './IcpSegment'
import { StrategicTheme } from './StrategicTheme'
import { ContentAsset } from './ContentAsset'
```

**Step 3: Add new columns + relations inside `@Entity` class**

В конец класса `ContentUnit` (перед `@OneToMany(() => ContentPublication ...)`):

```typescript
  @Column({ type: 'uuid', nullable: true })
  target_segment_id: string | null

  @ManyToOne(() => IcpSegment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_segment_id' })
  target_segment: IcpSegment | null

  @Column({ type: 'uuid', nullable: true })
  theme_id: string | null

  @ManyToOne(() => StrategicTheme, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'theme_id' })
  theme: StrategicTheme | null

  @Column({ type: 'jsonb', nullable: true })
  recipe_state: Record<string, unknown> | null

  @Column({ type: 'timestamptz', nullable: true })
  production_started_at: Date | null

  @OneToMany(() => ContentAsset, (a) => a.content_unit)
  assets: ContentAsset[]
```

**Step 4: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0 errors. Если падает на `ContentAsset` relation — проверь, что Task 6 закоммичен.

**Step 5: Commit**

```bash
git add backend/src/entities/ContentUnit.ts
git commit -m "feat(entities): extend ContentUnit — 12 content_types, strategy FKs, recipe_state, assets relation"
```

---

## Task 9: Extend `ContentPublication` — channel_id + auto_publish + publisher_log

**Files:**
- Modify: `backend/src/entities/ContentPublication.ts`

**Context:** `network: string` остаётся (для backward compat и backfill). Добавляем nullable `channel_id` (станет NOT NULL в Phase A continuation после backfill). Добавляем `auto_publish` и `publisher_log` — они будут использоваться в Phase D, но колонки в БД уже созданы Task 1.

**Step 1: Add import for Channel**

В начале файла, после `import { ContentUnit } from './ContentUnit'`:

```typescript
import { Channel } from './Channel'
```

**Step 2: Add new columns + relation inside class**

После существующего поля `network`, добавь:

```typescript
  @Column({ type: 'uuid', nullable: true })
  channel_id: string | null

  @ManyToOne(() => Channel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel | null
```

После поля `sort_order` (перед `@CreateDateColumn`):

```typescript
  @Column({ type: 'boolean', default: false })
  auto_publish: boolean

  @Column({ type: 'jsonb', nullable: true })
  publisher_log: Record<string, unknown> | null
```

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```

**Step 4: Commit**

```bash
git add backend/src/entities/ContentPublication.ts
git commit -m "feat(entities): add channel_id + auto_publish + publisher_log to ContentPublication"
```

---

## Task 10: Register new entities in `database.ts`

**Files:**
- Modify: `backend/src/config/database.ts`

**Context:** TypeORM нуждается в явном списке entities в `allEntities` array — иначе не подтянет ни metadata, ни repositories.

**Step 1: Add imports**

После последнего существующего entity import (после `import { BrandDoc } from '../entities/BrandDoc';`):

```typescript
import { IcpSegment } from '../entities/IcpSegment';
import { StrategicTheme } from '../entities/StrategicTheme';
import { Channel } from '../entities/Channel';
import { ChannelBudget } from '../entities/ChannelBudget';
import { ContentAsset } from '../entities/ContentAsset';
import { ContentMetricSnapshot } from '../entities/ContentMetricSnapshot';
```

**Step 2: Add to `allEntities` array**

В существующий массив `allEntities = [...]` добавь шесть новых entity classes в конец (перед закрывающим `]`):

```typescript
, IcpSegment, StrategicTheme, Channel, ChannelBudget, ContentAsset, ContentMetricSnapshot
```

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit && cd ..
```
Expected: 0 errors.

**Step 4: Smoke-test server start**

```bash
cd backend && npm run dev &
SERVER_PID=$!
sleep 5
curl -sf http://localhost:3001/health
echo
kill $SERVER_PID 2>/dev/null
cd ..
```
Expected: HTTP 200 with health response. Если сервер не стартует — почти всегда ошибка в импортах или relation; читай stderr.

**Step 5: Commit**

```bash
git add backend/src/config/database.ts
git commit -m "feat(db): register marketing-phase-a entities in DataSource"
```

---

## Task 11: Seed initial channels

**Files:**
- Create: `backend/src/seeds/seed-channels.ts`
- Modify: `backend/package.json` (add `seed:channels` script)

**Context:** Сидаем начальные строки `channel` соответственно существующим значениям `content_publications.network`. После этого Task 12 сможет сделать backfill `channel_id` по `slug == network`.

**Step 1: Find existing network values in production**

В Supabase SQL Editor:
```sql
SELECT DISTINCT network, COUNT(*) FROM content_publications GROUP BY network ORDER BY 2 DESC;
```

Запиши результат — он определит, какие slug-и нужны. Ожидаются варианты типа `tiktok`, `reels`, `youtube_shorts`, `telegram`, `vk`, `x`, `youtube`, `instagram`. Если найдётся неожиданное значение — добавь его в seed (см. ниже).

**Step 2: Write the seed script**

Create `backend/src/seeds/seed-channels.ts`:

```typescript
import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '../config/database'
import { Channel, ChannelPlatform } from '../entities/Channel'

interface SeedChannel {
  slug: string
  display_name: string
  platform: ChannelPlatform
  account_handle?: string
  profile_url?: string
}

// Baseline set — adjust based on the DISTINCT query from Step 1.
// Slugs MUST match existing `content_publications.network` values
// for backfill in Task 12 to work.
const seeds: SeedChannel[] = [
  { slug: 'tiktok', display_name: 'TikTok', platform: 'tiktok' },
  { slug: 'reels', display_name: 'Instagram Reels', platform: 'reels' },
  { slug: 'youtube_shorts', display_name: 'YouTube Shorts', platform: 'youtube_shorts' },
  { slug: 'youtube', display_name: 'YouTube', platform: 'youtube' },
  { slug: 'telegram', display_name: 'Telegram (main)', platform: 'telegram' },
  { slug: 'vk', display_name: 'VK', platform: 'vk' },
  { slug: 'x', display_name: 'X (Twitter)', platform: 'x' },
  { slug: 'instagram', display_name: 'Instagram (feed)', platform: 'instagram' },
]

async function main() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(Channel)
  let created = 0
  let skipped = 0
  for (const s of seeds) {
    const existing = await repo.findOne({ where: { slug: s.slug } })
    if (existing) {
      skipped++
      continue
    }
    await repo.save(repo.create({
      slug: s.slug,
      display_name: s.display_name,
      platform: s.platform,
      account_handle: s.account_handle ?? null,
      profile_url: s.profile_url ?? null,
      integration_status: 'manual',
      active: true,
    }))
    created++
  }
  console.log(`Channels: created=${created} skipped=${skipped}`)
  await AppDataSource.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Step 3: Add npm script**

В `backend/package.json` в `scripts` добавь:
```json
"seed:channels": "ts-node src/seeds/seed-channels.ts"
```
Сразу после строки `"seed:content-bank": ...`.

**Step 4: Run the seed**

```bash
cd backend && npm run seed:channels
cd ..
```
Expected console output: `Channels: created=8 skipped=0` (или другие числа, если уже частично сидали).

**Step 5: Verify in DB**

В Supabase SQL Editor:
```sql
SELECT slug, display_name, platform FROM channel ORDER BY slug;
```
Expected: список slug-ов точно соответствующий тому, что мы добавили + покрывающий все DISTINCT `network` значения из Step 1.

⚠ **Если в `content_publications.network` найдётся значение БЕЗ соответствующего channel.slug** — добавь его в `seeds` массив, перезапусти seed (он идемпотентный), проверь снова.

**Step 6: Commit**

```bash
git add backend/src/seeds/seed-channels.ts backend/package.json
git commit -m "feat(seeds): initial channels matching existing network strings"
```

---

## Task 12: Backfill `content_publications.channel_id`

**Files:**
- Create: `backend/src/migrations/2026-05-11-marketing-phase-a-backfill.sql`

**Context:** После сидов каналов делаем UPDATE на FK. Отдельный файл от Task 1 — это data-migration, не schema-migration; запускается ПОСЛЕ применения Task 1 и Task 11.

**Step 1: Write the backfill SQL**

Create `backend/src/migrations/2026-05-11-marketing-phase-a-backfill.sql`:

```sql
-- 2026-05-11 Marketing Phase A — backfill content_publications.channel_id
-- Apply in Supabase SQL Editor AFTER `seed:channels` has run.
-- Safe to re-run: WHERE channel_id IS NULL ensures we don't overwrite.

BEGIN;

UPDATE content_publications cp
SET channel_id = c.id
FROM channel c
WHERE cp.channel_id IS NULL
  AND cp.network = c.slug;

-- Report orphans (publications whose network has no matching channel.slug).
-- If this returns rows, fix by adding the missing channel via seed, re-run backfill.
SELECT cp.id, cp.network, cp.published_url
FROM content_publications cp
WHERE cp.channel_id IS NULL;

COMMIT;
```

**Step 2: Apply in Supabase SQL Editor**

1. Скопировать файл, запустить в Supabase.
2. Проверить, что финальный `SELECT` возвращает **0 строк** (no orphans).
3. Если orphans есть — найди, какой `network`-string не имеет канала, добавь в `seed-channels.ts`, запусти `npm run seed:channels`, повтори backfill.

**Step 3: Verify**

В Supabase SQL Editor:
```sql
SELECT
  (SELECT COUNT(*) FROM content_publications) AS total,
  (SELECT COUNT(*) FROM content_publications WHERE channel_id IS NOT NULL) AS with_channel,
  (SELECT COUNT(*) FROM content_publications WHERE channel_id IS NULL) AS orphan;
```
Expected: `total == with_channel`, `orphan == 0`.

**Step 4: Commit**

```bash
git add backend/src/migrations/2026-05-11-marketing-phase-a-backfill.sql
git commit -m "feat(marketing): phase A — backfill content_publications.channel_id from network slug"
```

---

## Task 13: Smoke-test the existing content-bank still works

**Files:** (no changes — verification only)

**Context:** Перед закрытием фазы проверяем, что текущий content-bank UI ничего не сломалось от расширения `ContentUnit` и `ContentPublication`.

**Step 1: Start full stack**

```bash
cd backend && npm run dev &
BACKEND_PID=$!
cd ../frontend && npm run dev &
FRONTEND_PID=$!
cd ..
sleep 8
```

**Step 2: Hit existing endpoints**

```bash
# List existing content units (existing endpoint, не должен сломаться)
curl -sf http://localhost:3001/api/content-bank/units | jq '.[] | .id' | head -5

# Get a publication with channel relation
curl -sf "http://localhost:3001/api/content-bank/units?limit=1" | jq '.[0]'
```
Expected: эндпоинты возвращают данные как раньше; новые поля присутствуют, но nullable / пустые.

**Step 3: Open `/content-bank` in browser**

```bash
open http://localhost:5173/content-bank
```
Проверить вручную:
- Список юнитов рендерится.
- Триаж работает.
- Pipeline-дашборд работает.
- Создание нового юнита (если есть форма) проходит.

**Step 4: Cleanup processes**

```bash
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
```

**Step 5: If everything is green — no commit, just proceed to Task 14**

Если что-то сломалось — открой issue в этом плане как «Phase A regression» и зафикси до закрытия фазы.

---

## Task 14: Final summary commit + push

**Files:**
- (no code changes — commit a CHANGELOG note in PRD)

**Step 1: Verify clean working tree**

```bash
git status
```
Expected: clean.

**Step 2: Quick scan of commits**

```bash
git log --oneline c7ef438..HEAD
```
Expected: ~10 коммитов, каждый описан в Tasks 1–12.

**Step 3: Push both remotes (per CLAUDE.md two-remote convention)**

```bash
git push origin HEAD
git push vercel-deploy HEAD || echo "vercel-deploy remote may not be set on this branch — skip if so"
```

(Frontend не менялся, поэтому vercel-deploy реально не нужен для Phase A, но привычка двух-remote push есть в handoff doc.)

**Step 4: Mark phase complete**

В этом плане файле сверху обнови `Status:` line (можно отдельным коммитом):
```
**Status:** Phase A complete on YYYY-MM-DD. Ready for Phase B (Strategy + Channels UI).
```

```bash
git commit -am "docs(plans): mark marketing phase A complete"
git push origin HEAD
```

---

## Post-Phase-A — что должно быть на момент закрытия

- 6 новых таблиц в Supabase: `icp_segment`, `strategic_theme`, `channel`, `channel_budget`, `content_asset`, `content_metric_snapshot`.
- 4 новых nullable поля в `content_units`: `target_segment_id`, `theme_id`, `recipe_state`, `production_started_at`.
- 3 новых поля в `content_publications`: `channel_id` (nullable, но **заполнено для всех существующих строк через backfill**), `auto_publish`, `publisher_log`.
- 6 новых TypeORM entity, зарегистрированных в DataSource.
- Сид `seed:channels` с 8 каналами по умолчанию.
- Существующий short_video pipeline работает без изменений.
- 0 UX-изменений.

## Что НЕ делается в Phase A (см. план B и далее)

- UI для `/marketing/strategy`, `/settings/channels` — Phase B.
- Recipe-engine + per-type recipes — Phase C.
- ChannelPublisher + Telegram Bot — Phase D.
- Метрики UI + воркер — Phase E.
- Drop column `content_publications.network` + NOT NULL constraint на `channel_id` — после полной верификации (отдельный план в начале Phase B).

---

## Anti-pitfalls (от смежных Claude-сессий, не от текущей)

- **НЕ применяй миграцию к prod до того, как code-PR смержен.** Конвенция проекта: SQL применяется первым, код деплоится вторым. Но и наоборот хуже — не сделай так, чтобы код пошёл в прод без миграции, или ты получишь "column does not exist" в логах Railway.
- **НЕ запускай `seed:channels` в проде, если уже сидил вручную.** Скрипт идемпотентный (WHERE slug NOT EXISTS), но если в проде уже есть channel с тем же slug но другим display_name — он скипнет без апдейта. Это by design.
- **НЕ удаляй `network` колонку в этой фазе.** Дроп — отдельный план, после Phase B верификации.
- **НЕ добавляй tests/CI gates в этом плане.** Проект не имеет тестового фреймворка, добавление одной test infra — отдельная инициатива; протащить её через Phase A добавит риска без ценности.
