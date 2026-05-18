# Bank Sync (Phase 1: Точка) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Автоматизировать ежедневную выгрузку транзакций из Точки через JWT API. Убрать ручной шаг «скачать Excel → загрузить» для Точки. Озон-расчётник (Phase 2) — отдельным планом позже.

**Architecture:** Новая таблица `bank_sync_config` хранит per-аккаунтные настройки + зашифрованные creds (AES-256-GCM). Daily `node-cron` в Express → расшифровать → дёрнуть Точку → нормализовать → existing import pipeline (extracted в `bankImportService.commitNormalized` для переиспользования). Pending-review queue через новый флаг `transactions.needs_review`.

**Tech Stack:** TypeORM + Postgres миграции, Node `crypto` (AES-256-GCM, native), `node-cron` (existing dep если есть, иначе добавляем), Axios для Точки API. Frontend — новая секция на `/cashflow`, реиспользует BrandDocCardsSection-паттерн.

**Design reference:** `docs/plans/2026-05-18-bank-sync-design.md`

**Testing note:** Проект без test runner — каждая задача завершается `typecheck + smoke`. Финальный smoke — на проде после деплоя.

---

## Task 1: Миграция БД (новые таблицы + колонка)

**Files:**
- Create: `backend/src/migrations/2026-05-18-bank-sync.sql`

**Step 1: Создать миграцию**

`backend/src/migrations/2026-05-18-bank-sync.sql`:

```sql
-- Bank sync infrastructure: per-account configs + sync logs + needs_review flag.
--
-- bank_sync_config — один на (bank_account, provider). credentials_encrypted
-- хранит AES-256-GCM JSON с токенами; ключ шифрования живёт в env var
-- BANK_SYNC_SECRET_KEY на Railway.
--
-- bank_sync_log — журнал попыток для UI status + debugging.
--
-- transactions.needs_review — флаг для pending-review queue (транзакция
-- импортирована без сматчившегося ImportRule, оператор должен присвоить
-- категорию/контрагента).

CREATE TABLE IF NOT EXISTS bank_sync_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id       uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  provider              varchar(40) NOT NULL,
  enabled               boolean NOT NULL DEFAULT true,
  credentials_encrypted text,
  last_sync_at          timestamptz,
  last_period_end       date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, provider)
);

CREATE TABLE IF NOT EXISTS bank_sync_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_sync_config_id   uuid NOT NULL REFERENCES bank_sync_config(id) ON DELETE CASCADE,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  status                varchar(20) NOT NULL DEFAULT 'running',
  period_start          date,
  period_end            date,
  rows_fetched          integer NOT NULL DEFAULT 0,
  rows_imported         integer NOT NULL DEFAULT 0,
  rows_skipped_dup      integer NOT NULL DEFAULT 0,
  rows_pending_review   integer NOT NULL DEFAULT 0,
  error_message         text
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_log_config_started
  ON bank_sync_log (bank_sync_config_id, started_at DESC);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_needs_review
  ON transactions (needs_review) WHERE needs_review = true;
```

**Step 2: Применить через Supabase MCP**

`apply_migration` на project `jubkezbvccwvujregkfq`, name: `2026_05_18_bank_sync`, query = SQL выше.

**Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('bank_sync_config', 'bank_sync_log');

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'needs_review';
```

Expected: 2 таблицы + 1 колонка boolean.

**Step 4: Commit**

```bash
git add backend/src/migrations/2026-05-18-bank-sync.sql
git commit -m "feat(bank-sync): migration — sync_config, sync_log, transactions.needs_review"
```

---

## Task 2: TypeORM entities

**Files:**
- Create: `backend/src/entities/BankSyncConfig.ts`
- Create: `backend/src/entities/BankSyncLog.ts`
- Modify: `backend/src/entities/Transaction.ts` (добавить `needs_review`)

**Step 1: BankSyncConfig**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm'
import { BankAccount } from './BankAccount'
import { BankSyncLog } from './BankSyncLog'

export type BankSyncProvider = 'tochka' | 'ozon_email'

@Entity('bank_sync_config')
@Unique(['bank_account_id', 'provider'])
export class BankSyncConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  bank_account_id: string

  @ManyToOne(() => BankAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account: BankAccount

  @Column({ type: 'varchar', length: 40 })
  provider: BankSyncProvider

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'text', nullable: true })
  credentials_encrypted: string | null

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at: Date | null

  @Column({ type: 'date', nullable: true })
  last_period_end: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => BankSyncLog, (l) => l.bank_sync_config)
  logs: BankSyncLog[]
}
```

**Step 2: BankSyncLog**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BankSyncConfig } from './BankSyncConfig'

export type BankSyncStatus = 'running' | 'success' | 'partial' | 'failed'

@Entity('bank_sync_log')
@Index(['bank_sync_config_id', 'started_at'])
export class BankSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  bank_sync_config_id: string

  @ManyToOne(() => BankSyncConfig, (c) => c.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bank_sync_config_id' })
  bank_sync_config: BankSyncConfig

  @Column({ type: 'timestamptz', default: () => 'now()' })
  started_at: Date

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: BankSyncStatus

  @Column({ type: 'date', nullable: true })
  period_start: string | null

  @Column({ type: 'date', nullable: true })
  period_end: string | null

  @Column({ type: 'integer', default: 0 })
  rows_fetched: number

  @Column({ type: 'integer', default: 0 })
  rows_imported: number

  @Column({ type: 'integer', default: 0 })
  rows_skipped_dup: number

  @Column({ type: 'integer', default: 0 })
  rows_pending_review: number

  @Column({ type: 'text', nullable: true })
  error_message: string | null
}
```

**Step 3: Расширить Transaction entity**

В `backend/src/entities/Transaction.ts`, после поля `linked_transfer_id` (около строки 104), добавить:

```typescript
  @Column({ type: 'boolean', default: false })
  needs_review: boolean;
```

**Step 4: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "js-yaml"
```
Expected: пусто.

**Step 5: Commit**

```bash
git add backend/src/entities/BankSyncConfig.ts backend/src/entities/BankSyncLog.ts backend/src/entities/Transaction.ts
git commit -m "feat(bank-sync): TypeORM entities for sync config + log + needs_review flag"
```

---

## Task 3: Crypto util (AES-256-GCM encrypt/decrypt JSON)

**Files:**
- Create: `backend/src/lib/crypto-util.ts`

**Step 1: Implement**

`backend/src/lib/crypto-util.ts`:

```typescript
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

/**
 * Encrypts a JSON-serializable value with AES-256-GCM.
 * Output format: base64(iv(12) || authTag(16) || ciphertext)
 *
 * Master key — base64-encoded 32 bytes (256 bits) from env var.
 */
export function encryptJson(value: unknown, masterKeyBase64: string): string {
  const key = Buffer.from(masterKeyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('Master key must be 32 bytes (base64 of 32 bytes)')
  }
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypts a string produced by encryptJson and returns parsed JSON.
 * Throws if tampered, wrong key, or invalid format.
 */
export function decryptJson<T = unknown>(blob: string, masterKeyBase64: string): T {
  const key = Buffer.from(masterKeyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('Master key must be 32 bytes (base64 of 32 bytes)')
  }
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < IV_BYTES + 16 + 1) {
    throw new Error('Encrypted blob too short')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + 16)
  const ciphertext = buf.subarray(IV_BYTES + 16)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8')) as T
}

/**
 * Generate a fresh master key as base64. Use this once when first setting up
 * BANK_SYNC_SECRET_KEY env var. Output goes into Railway env. Never log.
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('base64')
}
```

**Step 2: Quick local sanity check (ad-hoc REPL test)**

```bash
cd backend
node -e "
const { encryptJson, decryptJson, generateMasterKey } = require('./src/lib/crypto-util.ts');
const key = generateMasterKey();
const blob = encryptJson({ token: 'eyJabc...', client_id: 'xyz' }, key);
console.log('encrypted:', blob.slice(0, 40) + '...');
console.log('decrypted:', decryptJson(blob, key));
"
```
Expected: roundtrip prints `{token: 'eyJabc...', client_id: 'xyz'}`.

(Если `node` не понимает .ts — пропусти этот шаг, проверим в Task 4 при использовании.)

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep crypto-util
```
Expected: пусто.

**Step 4: Commit**

```bash
git add backend/src/lib/crypto-util.ts
git commit -m "feat(bank-sync): AES-256-GCM JSON encryption util"
```

---

## Task 4: Точка API клиент

**Files:**
- Create: `backend/src/services/bank-sync/tochka.api.ts`

**Step 1: Implement**

`backend/src/services/bank-sync/tochka.api.ts`:

```typescript
import axios, { AxiosInstance } from 'axios'
import { NormalizedRow } from '../bank-parsers/types'

export interface TochkaCredentials {
  token: string
  client_id: string
  customer_code?: string
}

interface TochkaAccount {
  accountId: string
  accountNumber: string
  accountName?: string
  bik?: string
  currency: string
}

interface TochkaTransaction {
  transactionId: string
  operationDate: string         // YYYY-MM-DD
  direction: 'Credit' | 'Debit'
  amount: number
  counterparty?: {
    name?: string
    inn?: string
    bik?: string
    account?: string
  }
  paymentPurpose?: string
  documentNumber?: string
}

const BASE_URL = 'https://enter.tochka.com/uapi/open-banking/v1.0'

export class TochkaApiClient {
  private http: AxiosInstance

  constructor(private creds: TochkaCredentials) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'client-id': creds.client_id,
      },
      timeout: 30_000,
    })
  }

  /** List accounts for the customer. If customer_code is set, scopes to that customer. */
  async listAccounts(): Promise<TochkaAccount[]> {
    const path = this.creds.customer_code
      ? `/accounts/${this.creds.customer_code}`
      : '/accounts'
    const r = await this.http.get(path)
    // Tochka responses are envelope-style: {Data: {Account: [...]}}
    return r.data?.Data?.Account ?? r.data?.accounts ?? []
  }

  /**
   * Fetch statement (transactions) for a given account over a date range.
   * @param accountCode — accountId returned by listAccounts
   * @param from / to — YYYY-MM-DD
   */
  async fetchStatement(
    accountCode: string,
    from: string,
    to: string,
  ): Promise<TochkaTransaction[]> {
    const customer = this.creds.customer_code ?? ''
    const path = customer
      ? `/accounts/${customer}/${accountCode}/statement`
      : `/accounts/${accountCode}/statement`
    const r = await this.http.get(path, { params: { dateFrom: from, dateTo: to } })
    // Tochka envelope: {Data: {Transaction: [...]}}
    return r.data?.Data?.Transaction ?? r.data?.transactions ?? []
  }
}

/**
 * Map Tochka API transaction to our internal NormalizedRow shape.
 * Output matches what tochka.parser.ts produces from Excel, so the same
 * import pipeline downstream works without changes.
 */
export function tochkaApiToNormalizedRow(tx: TochkaTransaction): NormalizedRow {
  const type: 'income' | 'expense' = tx.direction === 'Credit' ? 'income' : 'expense'
  const innRaw = tx.counterparty?.inn || ''
  return {
    external_id: tx.transactionId || tx.documentNumber || null,
    date: tx.operationDate,
    type,
    amount: Math.abs(tx.amount),
    counterparty_name: (tx.counterparty?.name || '').trim(),
    counterparty_inn: /^\d{10,12}$/.test(innRaw) ? innRaw : null,
    description: (tx.paymentPurpose || '').trim(),
    raw: tx,
  }
}
```

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep tochka.api
```
Expected: пусто.

**Step 3: Commit**

```bash
git add backend/src/services/bank-sync/tochka.api.ts
git commit -m "feat(bank-sync): Точка API клиент + NormalizedRow mapper"
```

**Note for executing-plans agent:** Реальная схема Точка-ответа может отличаться от того, что я угадал (Tochka envelope `{Data:{Transaction:[...]}}` — best guess по их Open Banking докe). Точная нормализация уточнится на этапе smoke-тестов (Task 9 — пользователь даёт реальный токен, видим сырой response, корректируем mapping). Текущая реализация — реалистичная заготовка, не блокирует продвижение.

---

## Task 5: bankImportService.commitNormalized (extracted shared logic)

**Files:**
- Create: `backend/src/services/bankImport.service.ts`
- Modify: `backend/src/controllers/bankImport.controller.ts` — рефакторинг `commit` чтобы вызывал service

**Step 1: Извлечь commit логику в service**

Открой `backend/src/controllers/bankImport.controller.ts:183-419` (метод `commit`). Это та логика, которую нужно вынести. Она делает:
1. Создаёт BankImport session
2. Resolve counterparties (по INN, потом по name; dedup; bulk insert новых)
3. Apply ImportRules для авто-категоризации
4. Bulk insert transactions
5. Mark transfers
6. Save rules-to-create

Создай `backend/src/services/bankImport.service.ts`:

```typescript
import { AppDataSource } from '../config/database'
import { BankImport } from '../entities/BankImport'
import { Transaction, TransactionSource, TransactionType } from '../entities/Transaction'
import { Counterparty } from '../entities/Counterparty'
import { ImportRule } from '../entities/ImportRule'
import type { NormalizedRow } from './bank-parsers/types'

export interface CommitNormalizedRowsInput {
  bank_account_id: string
  rows: NormalizedRow[]
  file_name: string                       // 'tochka-sync-2026-05-18' or similar synthetic name
  period_start: string | null
  period_end: string | null
  imported_by: string | null
  /** If true — rows without an ImportRule match are flagged needs_review=true. */
  flag_unmatched_for_review: boolean
}

export interface CommitNormalizedRowsResult {
  import_id: string
  rows_imported: number
  rows_skipped_dup: number
  rows_pending_review: number
}

export const bankImportService = {
  /**
   * Common import path used by both manual file upload (controller) and
   * auto-sync (BankSyncService). Idempotent via Transaction.external_id —
   * duplicates are silently skipped.
   *
   * When flag_unmatched_for_review=true (auto-sync case), transactions with
   * no matching ImportRule get `needs_review = true` so they surface in the
   * Cashflow «Требуют категоризации» queue.
   */
  async commitNormalized(input: CommitNormalizedRowsInput): Promise<CommitNormalizedRowsResult> {
    const importRepo = AppDataSource.getRepository(BankImport)
    const txRepo = AppDataSource.getRepository(Transaction)
    const cpRepo = AppDataSource.getRepository(Counterparty)
    const ruleRepo = AppDataSource.getRepository(ImportRule)

    const session = importRepo.create({
      bank_account_id: input.bank_account_id,
      file_name: input.file_name,
      period_start: input.period_start,
      period_end: input.period_end,
      total_rows: input.rows.length,
      imported_rows: 0,
      skipped_duplicates: 0,
      status: 'pending',
      imported_by: input.imported_by,
    })
    const savedSession = await importRepo.save(session)

    // 1. Resolve counterparties: bulk-fetch existing by INN, prepare new ones.
    const innsToLookup = Array.from(new Set(
      input.rows.filter((r) => r.counterparty_inn).map((r) => r.counterparty_inn!),
    ))
    const existingByInn = new Map<string, string>()
    if (innsToLookup.length > 0) {
      const found = await cpRepo.createQueryBuilder('cp')
        .select(['cp.id', 'cp.inn'])
        .where('cp.inn IN (:...inns)', { inns: innsToLookup })
        .getMany()
      found.forEach((cp) => existingByInn.set((cp as any).inn, cp.id))
    }

    type NewCp = { key: string; name: string; inn: string | null }
    const newCpMap = new Map<string, NewCp>()
    for (const r of input.rows) {
      if (!r.counterparty_name) continue
      if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) continue
      const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
      if (!newCpMap.has(key)) {
        newCpMap.set(key, { key, name: r.counterparty_name, inn: r.counterparty_inn || null })
      }
    }
    const newCpKeyToId = new Map<string, string>()
    if (newCpMap.size > 0) {
      const newCpList = Array.from(newCpMap.values())
      const insertResult = await cpRepo.insert(
        newCpList.map((cp) => ({ name: cp.name, inn: cp.inn })) as any[],
      )
      newCpList.forEach((cp, idx) => {
        newCpKeyToId.set(cp.key, (insertResult.identifiers[idx] as any).id)
      })
    }

    const resolveCounterpartyId = (r: NormalizedRow): string | null => {
      if (r.counterparty_inn && existingByInn.has(r.counterparty_inn)) {
        return existingByInn.get(r.counterparty_inn)!
      }
      if (!r.counterparty_name) return null
      const key = r.counterparty_inn ? `inn:${r.counterparty_inn}` : `name:${r.counterparty_name}`
      return newCpKeyToId.get(key) || null
    }

    // 2. Load ImportRules for auto-categorization.
    const rules = await ruleRepo.find()
    const matchRule = (r: NormalizedRow): { category_id: string | null; counterparty_id: string | null; is_transfer: boolean } | null => {
      for (const rule of rules) {
        if (rule.match_type === 'inn' && r.counterparty_inn === rule.match_value) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
        if (rule.match_type === 'name_keyword' && r.counterparty_name?.toLowerCase().includes(rule.match_value.toLowerCase())) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
        if (rule.match_type === 'description_keyword' && r.description?.toLowerCase().includes(rule.match_value.toLowerCase())) {
          return { category_id: rule.category_id, counterparty_id: rule.counterparty_id, is_transfer: rule.is_inter_transfer }
        }
      }
      return null
    }

    // 3. Check existing transactions by external_id for dedup.
    const externalIds = input.rows.map((r) => r.external_id).filter((x): x is string => !!x)
    const existingExternalIds = new Set<string>()
    if (externalIds.length > 0) {
      const found = await txRepo.createQueryBuilder('t')
        .select('t.external_id')
        .where('t.external_id IN (:...ids)', { ids: externalIds })
        .andWhere('t.bank_account_id = :bid', { bid: input.bank_account_id })
        .getMany()
      found.forEach((t) => t.external_id && existingExternalIds.add(t.external_id))
    }

    // 4. Build transactions to insert.
    let importedRows = 0
    let skippedDup = 0
    let pendingReview = 0
    const txsToInsert: Partial<Transaction>[] = []

    for (const r of input.rows) {
      if (r.external_id && existingExternalIds.has(r.external_id)) {
        skippedDup++
        continue
      }
      const rule = matchRule(r)
      const counterpartyId = rule?.counterparty_id || resolveCounterpartyId(r)
      const categoryId = rule?.category_id || null
      const needsReview = input.flag_unmatched_for_review && !rule

      txsToInsert.push({
        type: r.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
        amount: r.amount,
        description: r.description || r.counterparty_name || '(без описания)',
        date: new Date(r.date),
        category_id: categoryId,
        counterparty_id: counterpartyId,
        document_number: typeof r.raw === 'object' && r.raw && 'documentNumber' in (r.raw as any)
          ? String((r.raw as any).documentNumber || '')
          : null,
        source: TransactionSource.IMPORT,
        bank_account_id: input.bank_account_id,
        import_id: savedSession.id,
        external_id: r.external_id,
        raw_description: r.description,
        is_inter_account_transfer: rule?.is_transfer || false,
        needs_review: needsReview,
      })

      importedRows++
      if (needsReview) pendingReview++
    }

    if (txsToInsert.length > 0) {
      await txRepo.insert(txsToInsert as any[])
    }

    await importRepo.update(savedSession.id, {
      imported_rows: importedRows,
      skipped_duplicates: skippedDup,
      status: 'completed',
    })

    return {
      import_id: savedSession.id,
      rows_imported: importedRows,
      rows_skipped_dup: skippedDup,
      rows_pending_review: pendingReview,
    }
  },
}
```

**Step 2: Рефакторинг bankImport.controller.commit**

Существующий controller `commit` метод (lines 183-419) делает гораздо больше: принимает per-row `skip` флаги, обрабатывает rule-creation и transfer-linking. Чтобы НЕ ломать ручной upload — оставляем существующий controller как есть. Service — это **новый, отдельный entry point** для auto-sync. Никакого рефакторинга существующего controller’а в Task 5 нет.

(Опционально в будущем: вынести общую часть. Сейчас YAGNI — иметь два пути проще, чем гнаться за DRY и сломать ручной upload.)

**Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep bankImport.service
```
Expected: пусто.

**Step 4: Commit**

```bash
git add backend/src/services/bankImport.service.ts
git commit -m "feat(bank-sync): bankImportService.commitNormalized — shared import path"
```

---

## Task 6: BankSyncService + scheduler

**Files:**
- Create: `backend/src/services/bank-sync/bank-sync.service.ts`
- Create: `backend/src/services/bank-sync/scheduler.ts`
- Modify: `backend/src/server.ts` — запустить scheduler при старте

**Step 1: BankSyncService**

`backend/src/services/bank-sync/bank-sync.service.ts`:

```typescript
import { AppDataSource } from '../../config/database'
import { BankSyncConfig } from '../../entities/BankSyncConfig'
import { BankSyncLog } from '../../entities/BankSyncLog'
import { decryptJson } from '../../lib/crypto-util'
import { TochkaApiClient, TochkaCredentials, tochkaApiToNormalizedRow } from './tochka.api'
import { bankImportService } from '../bankImport.service'

const BACKFILL_DAYS = 30
const MASTER_KEY_ENV = 'BANK_SYNC_SECRET_KEY'

export const bankSyncService = {
  /** Run sync for all enabled configs. Called by cron. */
  async runAll(): Promise<void> {
    const configRepo = AppDataSource.getRepository(BankSyncConfig)
    const configs = await configRepo.find({ where: { enabled: true } })
    for (const config of configs) {
      try {
        await this.runOne(config.id)
      } catch (e: any) {
        console.error(`[bank-sync] config ${config.id} failed:`, e?.message || e)
      }
    }
  },

  /** Run sync for a single config. Returns the log entry. */
  async runOne(configId: string): Promise<BankSyncLog> {
    const masterKey = process.env[MASTER_KEY_ENV]
    if (!masterKey) {
      throw new Error(`${MASTER_KEY_ENV} env var is not set`)
    }

    const configRepo = AppDataSource.getRepository(BankSyncConfig)
    const logRepo = AppDataSource.getRepository(BankSyncLog)

    const config = await configRepo.findOne({ where: { id: configId } })
    if (!config) throw new Error(`Sync config ${configId} not found`)
    if (!config.credentials_encrypted) throw new Error('Credentials not set')

    // Determine sync period
    const today = new Date().toISOString().slice(0, 10)
    const from = config.last_period_end
      ? new Date(new Date(config.last_period_end).getTime() + 86400_000).toISOString().slice(0, 10)
      : new Date(Date.now() - BACKFILL_DAYS * 86400_000).toISOString().slice(0, 10)
    const to = today

    // Create log entry
    const log = logRepo.create({
      bank_sync_config_id: config.id,
      status: 'running',
      period_start: from,
      period_end: to,
    })
    const savedLog = await logRepo.save(log)

    try {
      let rowsFetched = 0
      let result: { rows_imported: number; rows_skipped_dup: number; rows_pending_review: number }

      if (config.provider === 'tochka') {
        const creds = decryptJson<TochkaCredentials>(config.credentials_encrypted, masterKey)
        const client = new TochkaApiClient(creds)
        const accounts = await client.listAccounts()
        // For MVP: take the first account. Multi-account support — future iteration.
        if (accounts.length === 0) throw new Error('Точка не вернула ни одного счёта')
        const account = accounts[0]
        const txs = await client.fetchStatement(account.accountId, from, to)
        rowsFetched = txs.length
        const rows = txs.map(tochkaApiToNormalizedRow)

        result = await bankImportService.commitNormalized({
          bank_account_id: config.bank_account_id,
          rows,
          file_name: `tochka-sync-${from}-to-${to}`,
          period_start: from,
          period_end: to,
          imported_by: null,
          flag_unmatched_for_review: true,
        })
      } else {
        throw new Error(`Provider ${config.provider} not implemented in Phase 1`)
      }

      // Mark log success + update config
      await logRepo.update(savedLog.id, {
        status: 'success',
        finished_at: new Date(),
        rows_fetched: rowsFetched,
        rows_imported: result.rows_imported,
        rows_skipped_dup: result.rows_skipped_dup,
        rows_pending_review: result.rows_pending_review,
      })
      await configRepo.update(config.id, {
        last_sync_at: new Date(),
        last_period_end: to,
      })

      const updated = await logRepo.findOne({ where: { id: savedLog.id } })
      return updated!
    } catch (e: any) {
      await logRepo.update(savedLog.id, {
        status: 'failed',
        finished_at: new Date(),
        error_message: String(e?.message || e).slice(0, 1000),
      })
      throw e
    }
  },
}
```

**Step 2: Scheduler**

`backend/src/services/bank-sync/scheduler.ts`:

```typescript
import cron from 'node-cron'
import { bankSyncService } from './bank-sync.service'

const CRON_SCHEDULE = '0 4 * * *' // 04:00 UTC = 07:00 MSK

let started = false

export function startBankSyncScheduler(): void {
  if (started) return
  if (process.env.BANK_SYNC_ENABLED === 'false') {
    console.log('[bank-sync] scheduler disabled via BANK_SYNC_ENABLED=false')
    return
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log('[bank-sync] cron tick starting')
    try {
      await bankSyncService.runAll()
      console.log('[bank-sync] cron tick complete')
    } catch (e: any) {
      console.error('[bank-sync] cron tick failed:', e?.message || e)
    }
  })
  started = true
  console.log(`[bank-sync] scheduler started (cron: ${CRON_SCHEDULE})`)
}
```

**Step 3: Hook into server startup**

Modify `backend/src/server.ts` — add near the bottom, after `app.listen`:

```typescript
import { startBankSyncScheduler } from './services/bank-sync/scheduler'
// ...
// After app.listen:
startBankSyncScheduler()
```

**Step 4: Verify node-cron is installed**

```bash
cd backend && cat package.json | grep -i "node-cron"
```

Если нет: `cd backend && npm install node-cron && npm install --save-dev @types/node-cron`.

**Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "bank-sync|scheduler"
```
Expected: пусто.

**Step 6: Commit**

```bash
git add backend/src/services/bank-sync/ backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(bank-sync): BankSyncService + node-cron scheduler"
```

---

## Task 7: REST API endpoints

**Files:**
- Create: `backend/src/controllers/bank-sync.controller.ts`
- Create: `backend/src/routes/bank-sync.routes.ts`
- Modify: `backend/src/server.ts` — mount route

**Step 1: Controller**

`backend/src/controllers/bank-sync.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankSyncConfig, BankSyncProvider } from '../entities/BankSyncConfig'
import { BankSyncLog } from '../entities/BankSyncLog'
import { encryptJson } from '../lib/crypto-util'
import { bankSyncService } from '../services/bank-sync/bank-sync.service'

const configRepo = () => AppDataSource.getRepository(BankSyncConfig)
const logRepo = () => AppDataSource.getRepository(BankSyncLog)
const MASTER_KEY_ENV = 'BANK_SYNC_SECRET_KEY'

function publicShape(config: BankSyncConfig) {
  // Never expose credentials_encrypted via API
  return {
    id: config.id,
    bank_account_id: config.bank_account_id,
    provider: config.provider,
    enabled: config.enabled,
    last_sync_at: config.last_sync_at,
    last_period_end: config.last_period_end,
    has_credentials: !!config.credentials_encrypted,
    created_at: config.created_at,
    updated_at: config.updated_at,
  }
}

export const bankSyncController = {
  async list(_req: Request, res: Response) {
    try {
      const configs = await configRepo().find({ order: { created_at: 'ASC' } })
      res.json(configs.map(publicShape))
    } catch (e: any) {
      console.error('[bank-sync.list]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки конфигов синхронизации' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const masterKey = process.env[MASTER_KEY_ENV]
      if (!masterKey) {
        return res.status(500).json({ error: 'BANK_SYNC_SECRET_KEY не настроен на сервере' })
      }
      const { bank_account_id, provider, credentials, run_initial_sync = true } = req.body as {
        bank_account_id: string
        provider: BankSyncProvider
        credentials: Record<string, unknown>
        run_initial_sync?: boolean
      }
      if (!bank_account_id || !provider || !credentials) {
        return res.status(400).json({ error: 'bank_account_id, provider, credentials обязательны' })
      }

      const encrypted = encryptJson(credentials, masterKey)
      const config = configRepo().create({
        bank_account_id,
        provider,
        enabled: true,
        credentials_encrypted: encrypted,
      })
      const saved = await configRepo().save(config)

      // Trigger initial sync in background (don't block the response)
      if (run_initial_sync) {
        bankSyncService.runOne(saved.id).catch((e) => {
          console.error('[bank-sync.create] initial sync failed:', e?.message || e)
        })
      }

      res.status(201).json(publicShape(saved))
    } catch (e: any) {
      console.error('[bank-sync.create]', e?.message || e)
      res.status(500).json({ error: 'Ошибка создания конфига синхронизации' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const masterKey = process.env[MASTER_KEY_ENV]
      if (!masterKey) {
        return res.status(500).json({ error: 'BANK_SYNC_SECRET_KEY не настроен на сервере' })
      }
      const { id } = req.params
      const { enabled, credentials } = req.body as {
        enabled?: boolean
        credentials?: Record<string, unknown>
      }

      const patch: Partial<BankSyncConfig> = {}
      if (typeof enabled === 'boolean') patch.enabled = enabled
      if (credentials) patch.credentials_encrypted = encryptJson(credentials, masterKey)

      await configRepo().update(id, patch)
      const updated = await configRepo().findOne({ where: { id } })
      if (!updated) return res.status(404).json({ error: 'Конфиг не найден' })
      res.json(publicShape(updated))
    } catch (e: any) {
      console.error('[bank-sync.update]', e?.message || e)
      res.status(500).json({ error: 'Ошибка обновления конфига' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const r = await configRepo().delete(req.params.id)
      if (r.affected === 0) return res.status(404).json({ error: 'Конфиг не найден' })
      res.json({ ok: true })
    } catch (e: any) {
      console.error('[bank-sync.delete]', e?.message || e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },

  async run(req: Request, res: Response) {
    try {
      const log = await bankSyncService.runOne(req.params.id)
      res.json({ ok: true, log })
    } catch (e: any) {
      console.error('[bank-sync.run]', e?.message || e)
      res.status(500).json({ error: String(e?.message || 'Ошибка синхронизации') })
    }
  },

  async listLogs(req: Request, res: Response) {
    try {
      const { config_id, limit = '20' } = req.query as { config_id?: string; limit?: string }
      const qb = logRepo().createQueryBuilder('l').orderBy('l.started_at', 'DESC').limit(Number(limit) || 20)
      if (config_id) qb.where('l.bank_sync_config_id = :cid', { cid: config_id })
      const logs = await qb.getMany()
      res.json(logs)
    } catch (e: any) {
      console.error('[bank-sync.listLogs]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки лога' })
    }
  },
}
```

**Step 2: Routes**

`backend/src/routes/bank-sync.routes.ts`:

```typescript
import { Router } from 'express'
import { bankSyncController } from '../controllers/bank-sync.controller'

const router = Router()

router.get('/logs', bankSyncController.listLogs)
router.get('/configs', bankSyncController.list)
router.post('/configs', bankSyncController.create)
router.put('/configs/:id', bankSyncController.update)
router.delete('/configs/:id', bankSyncController.delete)
router.post('/configs/:id/run', bankSyncController.run)

export default router
```

**Step 3: Mount**

В `backend/src/server.ts`, после `app.use('/api/bank-imports', authMiddleware, bankImportRoutes)`:

```typescript
import bankSyncRoutes from './routes/bank-sync.routes'
// ...
app.use('/api/bank-sync', authMiddleware, bankSyncRoutes)
```

**Step 4: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "bank-sync"
```
Expected: пусто.

**Step 5: Commit**

```bash
git add backend/src/controllers/bank-sync.controller.ts backend/src/routes/bank-sync.routes.ts backend/src/server.ts
git commit -m "feat(bank-sync): REST API endpoints + route mount"
```

---

## Task 8: Frontend API + UI секция

**Files:**
- Create: `frontend/src/api/bankSync.ts`
- Create: `frontend/src/components/cashflow/BankSyncSection.tsx`
- Create: `frontend/src/components/cashflow/BankSyncConfigModal.tsx`
- Modify: `frontend/src/pages/Cashflow.tsx` — добавить `<BankSyncSection />`

**Step 1: API client**

`frontend/src/api/bankSync.ts`:

```typescript
import { apiClient } from './client'

export type BankSyncProvider = 'tochka' | 'ozon_email'

export interface BankSyncConfig {
  id: string
  bank_account_id: string
  provider: BankSyncProvider
  enabled: boolean
  last_sync_at: string | null
  last_period_end: string | null
  has_credentials: boolean
  created_at: string
  updated_at: string
}

export interface BankSyncLog {
  id: string
  bank_sync_config_id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  period_start: string | null
  period_end: string | null
  rows_fetched: number
  rows_imported: number
  rows_skipped_dup: number
  rows_pending_review: number
  error_message: string | null
}

export const bankSyncApi = {
  listConfigs: async (): Promise<BankSyncConfig[]> => {
    const r = await apiClient.get<BankSyncConfig[]>('/bank-sync/configs')
    return r.data
  },
  createConfig: async (payload: {
    bank_account_id: string
    provider: BankSyncProvider
    credentials: Record<string, unknown>
    run_initial_sync?: boolean
  }): Promise<BankSyncConfig> => {
    const r = await apiClient.post<BankSyncConfig>('/bank-sync/configs', payload)
    return r.data
  },
  updateConfig: async (
    id: string,
    payload: { enabled?: boolean; credentials?: Record<string, unknown> },
  ): Promise<BankSyncConfig> => {
    const r = await apiClient.put<BankSyncConfig>(`/bank-sync/configs/${id}`, payload)
    return r.data
  },
  deleteConfig: async (id: string): Promise<void> => {
    await apiClient.delete(`/bank-sync/configs/${id}`)
  },
  run: async (id: string): Promise<{ ok: true; log: BankSyncLog }> => {
    const r = await apiClient.post<{ ok: true; log: BankSyncLog }>(`/bank-sync/configs/${id}/run`)
    return r.data
  },
  logs: async (configId?: string): Promise<BankSyncLog[]> => {
    const params = configId ? { config_id: configId } : undefined
    const r = await apiClient.get<BankSyncLog[]>('/bank-sync/logs', { params })
    return r.data
  },
}
```

**Step 2: Config modal**

`frontend/src/components/cashflow/BankSyncConfigModal.tsx`:

```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'
import { bankSyncApi } from '../../api/bankSync'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  bankAccountId: string
  bankAccountName: string
  /** If editing existing — pass id; otherwise creates new */
  configId?: string
  onClose: () => void
  onSaved: () => void
}

export function BankSyncConfigModal({ bankAccountId, bankAccountName, configId, onClose, onSaved }: Props) {
  const toast = useToast()
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!token.trim() || !clientId.trim()) {
      toast.error('Заполни Token и Client_ID')
      return
    }
    setSaving(true)
    try {
      const credentials = {
        token: token.trim(),
        client_id: clientId.trim(),
        ...(customerCode.trim() && { customer_code: customerCode.trim() }),
      }
      if (configId) {
        await bankSyncApi.updateConfig(configId, { credentials })
        toast.success('Креды обновлены')
      } else {
        await bankSyncApi.createConfig({
          bank_account_id: bankAccountId,
          provider: 'tochka',
          credentials,
          run_initial_sync: true,
        })
        toast.success('Подключено — синхронизация запущена в фоне')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-brand-border">
          <h2 className="text-xl font-semibold text-brand-text">
            Точка API — {bankAccountName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Token (JWT)</label>
            <textarea
              autoFocus
              className="input font-mono text-xs"
              rows={4}
              placeholder="eyJhbGciOiJSUzI1NiIs..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Client_ID</label>
            <input
              type="text"
              className="input"
              placeholder="6d90284ab1375a352f2d1fa6..."
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Customer Code (опционально)</label>
            <input
              type="text"
              className="input"
              placeholder="Если у тебя несколько customer-кодов — укажи нужный. Иначе оставь пустым."
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
            />
          </div>
          <p className="text-xs text-brand-text-secondary">
            Креды шифруются AES-256-GCM перед сохранением в БД. После сохранения запустится синхронизация за последние 30 дней.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-brand-border">
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Отмена
          </button>
          <button onClick={handleSave} className="btn btn-primary flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение…' : 'Сохранить и синхронизировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

**Step 3: Bank sync section**

`frontend/src/components/cashflow/BankSyncSection.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Landmark, RefreshCw, Settings, CheckCircle2, AlertTriangle } from 'lucide-react'
import { bankSyncApi, BankSyncConfig } from '../../api/bankSync'
import { useToast } from '../../contexts/ToastContext'
import { BankSyncConfigModal } from './BankSyncConfigModal'

interface BankAccount {
  id: string
  name: string
}

interface Props {
  bankAccounts: BankAccount[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function BankSyncSection({ bankAccounts }: Props) {
  const toast = useToast()
  const [configs, setConfigs] = useState<BankSyncConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ accountId: string; accountName: string; configId?: string } | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await bankSyncApi.listConfigs()
      setConfigs(r)
    } catch {
      toast.error('Не удалось загрузить конфиги синхронизации')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleRun = async (configId: string) => {
    setRunningId(configId)
    try {
      const r = await bankSyncApi.run(configId)
      toast.success(`Готово: ${r.log.rows_imported} новых, ${r.log.rows_skipped_dup} дубликатов`)
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка синхронизации')
    } finally {
      setRunningId(null)
    }
  }

  if (loading) {
    return (
      <section className="card mb-6">
        <div className="h-6 bg-muted rounded w-1/4 mb-3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card mb-6">
        <h2 className="text-2xl font-semibold text-brand-text flex items-center gap-2 mb-1">
          <Landmark className="h-6 w-6 text-primary-600" /> Источники данных
        </h2>
        <p className="text-brand-text-secondary text-sm mb-4">
          Автоматическая синхронизация транзакций из банков. Точка — через JWT API. Озон-расчётник — пока вручную (Phase 2).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bankAccounts.map((account) => {
            const config = configs.find((c) => c.bank_account_id === account.id && c.provider === 'tochka')
            const isOk = config?.enabled && config.last_sync_at
            return (
              <div key={account.id} className="rounded-2xl border border-brand-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-brand-text">🏦 {account.name}</h3>
                    <p className="text-xs text-brand-text-secondary">Точка API</p>
                  </div>
                  {config ? (
                    isOk ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 size={12} /> синк ОК
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle size={12} /> не синкан
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-brand-text-secondary">не настроено</span>
                  )}
                </div>
                {config && (
                  <p className="text-xs text-brand-text-secondary mb-3">
                    Последний sync: {formatDate(config.last_sync_at)}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing({ accountId: account.id, accountName: account.name, configId: config?.id })}
                    className="text-xs px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle flex items-center gap-1"
                  >
                    <Settings size={12} /> {config ? 'Изменить' : 'Подключить'}
                  </button>
                  {config && (
                    <button
                      onClick={() => handleRun(config.id)}
                      disabled={runningId === config.id}
                      className="text-xs px-2 py-1 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={runningId === config.id ? 'animate-spin' : ''} />
                      Синк сейчас
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {editing && (
        <BankSyncConfigModal
          bankAccountId={editing.accountId}
          bankAccountName={editing.accountName}
          configId={editing.configId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load()
          }}
        />
      )}
    </>
  )
}
```

**Step 4: Mount in Cashflow.tsx**

Открой `frontend/src/pages/Cashflow.tsx`, найди где грузятся `bankAccounts` (это уже должно быть, страница их использует). Добавь импорт и вставь `<BankSyncSection bankAccounts={bankAccounts} />` сразу под page header (до основной таблицы транзакций).

Точный place — на усмотрение implementer'а, страница ~1000 строк, нужно выбрать естественное место.

**Step 5: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "bankSync|BankSync|Cashflow"
```
Expected: пусто (или только pre-existing xlsx/@dnd-kit warnings, не наши).

**Step 6: Commit**

```bash
git add frontend/src/api/bankSync.ts frontend/src/components/cashflow/ frontend/src/pages/Cashflow.tsx
git commit -m "feat(bank-sync): frontend — BankSyncSection cards + config modal"
```

---

## Task 9: Setup env + final smoke + push

**Step 1: Сгенерить master key**

Локально, один раз:

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Скопировать вывод (base64-строка ~44 символа).

**Step 2: Установить на Railway**

Через Railway dashboard или CLI:

```bash
railway variables set BANK_SYNC_SECRET_KEY="<base64-from-step-1>"
```

(Или вручную через Railway UI → Variables → New variable.)

**Step 3: Push в оба ремоута**

```bash
git push origin main
git push vercel-deploy main
```

Railway автоматически рестартует backend, scheduler стартует, ждёт первого cron tick’а.

**Step 4: Прод-smoke (после деплоя ~3 мин)**

1. Открыть `/cashflow` — секция «Источники данных» видна, карточки для bank-аккаунтов из БД.
2. Клик «Подключить» на карточке Точки → модалка.
3. Вставить реальный Token + Client_ID (из ЛК Точки).
4. «Сохранить и синхронизировать» → тост «Подключено — синхронизация в фоне».
5. Через ~30 сек обновить страницу → карточка показывает «синк ОК» + last_sync.
6. Открыть Cashflow таблицу транзакций → видишь новые записи с `external_id` от Точки.
7. Запустить «Синк сейчас» второй раз → тост «0 новых, N дубликатов» (idempotent).
8. **Если что-то пошло не так** — смотри Railway logs: `[bank-sync]` префикс.
9. Если в response Точки реальный envelope-формат отличается от того, что в `tochkaApiToNormalizedRow` — корректируем по реальному JSON (Task 4 note про best-guess маппинг).

**Step 5: Cron-tick на следующий день**

В 07:00 MSK на следующий день должна автоматически запуститься синхронизация. В Railway logs — `[bank-sync] cron tick starting/complete`. В `bank_sync_log` — новая запись со вчерашним `period_start`.

---

## Reference: skill bridges

- @superpowers:executing-plans — execute этот план task-by-task
- @superpowers:systematic-debugging — если Точка API мапинг не совпал с предположениями
- @superpowers:verification-before-completion — проверить smoke до merge

## Principles baked in

- **DRY** — `bankImportService.commitNormalized` переиспользуется будущим Phase 2 (Ozon email)
- **YAGNI** — не реверсим DirectBank, не вводим webhook’и, не делаем pending-review UI с queue (флага в transaction достаточно)
- **TDD-адаптированный** — каждая задача завершается typecheck + smoke (нет test-runner’а)
- **Frequent commits** — 9 атомарных коммитов, каждый ревьюится/откатывается независимо
- **Security** — credentials всегда зашифрованы; master key только в env; raw credentials никогда не возвращаются в API responses (publicShape helper)

## Phase 2 outline (отдельным design+plan позже)

Только когда: Phase 1 устаканился 1+ неделю на проде, оператор подтвердил стабильность Точка-sync.

- Опция «выписка на e-mail» в Озон-Банке должна существовать → пользователь подключает на dedicated mailbox
- Backend: `provider='ozon_email'`, credentials = `{imap_host, imap_port, imap_user, imap_password, sender_filter}`
- `imapflow` библиотека, cron поллит ящик, прогоняет вложения через существующий `parseOzon`
- Если опции email-выписки нет → manual upload остаётся, Phase 2 закрывается без работ
