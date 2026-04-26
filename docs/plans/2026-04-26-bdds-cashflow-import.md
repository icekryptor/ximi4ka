# БДДС + Bank Statement Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Phase 1 (MVP) of the БДДС subsystem — Excel import for Tochka/Ozon, preview + rules learning, cashflow report with МСФО sections, month/week toggle, filters.

**Architecture:** Extend existing `transactions`/`categories`/`counterparties` tables. New tables: `bank_accounts`, `bank_imports`, `import_rules`. Excel parser per bank with SheetJS. Preview-then-commit import flow with learned rules. Single SQL aggregation for the report.

**Tech Stack:** Node + Express + TypeORM + Postgres (Supabase) backend; React + TypeScript + Vite + Tailwind frontend; `xlsx` (SheetJS) for parsing.

**Source design doc:** [docs/plans/2026-04-26-bdds-cashflow-import-design.md](2026-04-26-bdds-cashflow-import-design.md)

**Verification approach:** Project has no automated test framework. We use:
- TypeScript build (`npx tsc --noEmit`) as type safety check
- `curl` smoke tests for API endpoints
- Browser smoke tests for UI (use preview tools when previewable)
- Frequent small commits

---

## Stage 1 — Schema + Foundations

### Task 1.1: SQL migration — new tables and column extensions

**Files:**
- Create: `backend/src/migrations/2026-04-26-bdds-schema.sql` (reference doc only — actual migration runs via Supabase MCP)

**Step 1: Write migration SQL**

Create `backend/src/migrations/2026-04-26-bdds-schema.sql` with:

```sql
-- Extensions to existing tables
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS cashflow_section varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_cashflow_section ON categories(cashflow_section);

-- bank_accounts: our own accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  bank_code varchar(20) NOT NULL,
  account_number varchar(30),
  currency varchar(3) DEFAULT 'RUB',
  opening_balance numeric(15, 2) DEFAULT 0,
  opening_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- bank_imports: import history
CREATE TABLE IF NOT EXISTS bank_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  file_name varchar(255) NOT NULL,
  period_start date,
  period_end date,
  total_rows integer DEFAULT 0,
  imported_rows integer DEFAULT 0,
  skipped_duplicates integer DEFAULT 0,
  status varchar(20) DEFAULT 'pending',
  error_message text,
  imported_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_imports_account ON bank_imports(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_imports_status ON bank_imports(status);

-- import_rules: learned matching rules
CREATE TABLE IF NOT EXISTS import_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type varchar(30) NOT NULL,
  match_value varchar(255) NOT NULL,
  counterparty_id uuid REFERENCES counterparties(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_inter_transfer boolean DEFAULT false,
  hit_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_rules_unique
  ON import_rules(match_type, match_value);

-- Extensions to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES bank_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_description text,
  ADD COLUMN IF NOT EXISTS external_id varchar(100),
  ADD COLUMN IF NOT EXISTS is_inter_account_transfer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_transfer_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_unique
  ON transactions(bank_account_id, external_id) WHERE external_id IS NOT NULL;

-- Seed: Tochka and Ozon bank accounts
INSERT INTO bank_accounts (name, bank_code, account_number, currency)
VALUES
  ('Точка', 'tochka', '40802810220000929747', 'RUB'),
  ('Озон Банк', 'ozon', '40802810800000080788', 'RUB')
ON CONFLICT DO NOTHING;
```

**Step 2: Run migration via Supabase MCP**

Invoke `mcp__293619aa-...__apply_migration` with:
- `name`: `2026_04_26_bdds_schema`
- `query`: contents of `backend/src/migrations/2026-04-26-bdds-schema.sql`

Expected: migration succeeds, 3 new tables visible in Supabase, no errors.

**Step 3: Verify schema applied**

Run via Supabase MCP `execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('bank_accounts', 'bank_imports', 'import_rules');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name IN
  ('bank_account_id', 'import_id', 'raw_description', 'external_id',
   'is_inter_account_transfer', 'linked_transfer_id');
SELECT * FROM bank_accounts;
```

Expected: 3 tables, 6 new columns on transactions, 2 seed rows in bank_accounts.

**Step 4: Commit**

```bash
git add backend/src/migrations/2026-04-26-bdds-schema.sql
git commit -m "feat(bdds): add schema for bank accounts, imports, rules + transaction extensions"
```

---

### Task 1.2: TypeORM entities — BankAccount, BankImport, ImportRule

**Files:**
- Create: `backend/src/entities/BankAccount.ts`
- Create: `backend/src/entities/BankImport.ts`
- Create: `backend/src/entities/ImportRule.ts`
- Modify: `backend/src/entities/Category.ts` (add cashflow_section, parent_id)
- Modify: `backend/src/entities/Transaction.ts` (add 6 new fields)
- Modify: `backend/src/config/database.ts` (register new entities in `allEntities`)

**Step 1: Create BankAccount entity**

`backend/src/entities/BankAccount.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'varchar', length: 20 })
  bank_code: string

  @Column({ type: 'varchar', length: 30, nullable: true })
  account_number: string | null

  @Column({ type: 'varchar', length: 3, default: 'RUB' })
  currency: string

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  opening_balance: number

  @Column({ type: 'date', nullable: true })
  opening_date: string | null

  @Column({ type: 'boolean', default: true })
  is_active: boolean

  @CreateDateColumn() created_at: Date
  @UpdateDateColumn() updated_at: Date
}
```

**Step 2: Create BankImport entity**

`backend/src/entities/BankImport.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { BankAccount } from './BankAccount'

@Entity('bank_imports')
export class BankImport {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account: BankAccount | null

  @Column({ type: 'uuid', nullable: true })
  bank_account_id: string | null

  @Column({ type: 'varchar', length: 255 })
  file_name: string

  @Column({ type: 'date', nullable: true })
  period_start: string | null

  @Column({ type: 'date', nullable: true })
  period_end: string | null

  @Column({ type: 'integer', default: 0 })
  total_rows: number

  @Column({ type: 'integer', default: 0 })
  imported_rows: number

  @Column({ type: 'integer', default: 0 })
  skipped_duplicates: number

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string

  @Column({ type: 'text', nullable: true })
  error_message: string | null

  @Column({ type: 'uuid', nullable: true })
  imported_by: string | null

  @CreateDateColumn() created_at: Date
}
```

**Step 3: Create ImportRule entity**

`backend/src/entities/ImportRule.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('import_rules')
export class ImportRule {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 30 })
  match_type: 'inn' | 'name_keyword' | 'description_keyword'

  @Column({ type: 'varchar', length: 255 })
  match_value: string

  @Column({ type: 'uuid', nullable: true })
  counterparty_id: string | null

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null

  @Column({ type: 'boolean', default: false })
  is_inter_transfer: boolean

  @Column({ type: 'integer', default: 0 })
  hit_count: number

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null

  @CreateDateColumn() created_at: Date
}
```

**Step 4: Extend Category entity**

Read `backend/src/entities/Category.ts`. Add these columns:
```typescript
@Column({ type: 'varchar', length: 20, nullable: true })
cashflow_section: 'operational' | 'investing' | 'financing' | null

@Column({ type: 'uuid', nullable: true })
parent_id: string | null

@ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'parent_id' })
parent: Category | null
```

(Adjust imports if needed.)

**Step 5: Extend Transaction entity**

Read `backend/src/entities/Transaction.ts`. Add:
```typescript
import { BankAccount } from './BankAccount'
import { BankImport } from './BankImport'

// ... existing decorators

@ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'bank_account_id' })
bank_account: BankAccount | null

@Column({ type: 'uuid', nullable: true })
bank_account_id: string | null

@ManyToOne(() => BankImport, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'import_id' })
import_session: BankImport | null

@Column({ type: 'uuid', nullable: true })
import_id: string | null

@Column({ type: 'text', nullable: true })
raw_description: string | null

@Column({ type: 'varchar', length: 100, nullable: true })
external_id: string | null

@Column({ type: 'boolean', default: false })
is_inter_account_transfer: boolean

@Column({ type: 'uuid', nullable: true })
linked_transfer_id: string | null
```

**Step 6: Register entities in database config**

Edit `backend/src/config/database.ts`. Find `allEntities` array, add:
```typescript
import { BankAccount } from '../entities/BankAccount'
import { BankImport } from '../entities/BankImport'
import { ImportRule } from '../entities/ImportRule'

const allEntities = [
  // ... existing entities
  BankAccount,
  BankImport,
  ImportRule,
]
```

**Step 7: Verify TypeScript build**

Run:
```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors. If TS complains about `Category` parent self-reference, add `() => Category` lazy form.

**Step 8: Commit**

```bash
git add backend/src/entities/BankAccount.ts backend/src/entities/BankImport.ts backend/src/entities/ImportRule.ts backend/src/entities/Category.ts backend/src/entities/Transaction.ts backend/src/config/database.ts
git commit -m "feat(bdds): TypeORM entities for bank_accounts, bank_imports, import_rules"
```

---

### Task 1.3: Bank Accounts API (CRUD)

**Files:**
- Create: `backend/src/controllers/bankAccount.controller.ts`
- Create: `backend/src/routes/bankAccount.routes.ts`
- Modify: `backend/src/server.ts` (register route)

**Step 1: Create controller**

`backend/src/controllers/bankAccount.controller.ts`:
```typescript
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankAccount } from '../entities/BankAccount'

const repo = () => AppDataSource.getRepository(BankAccount)

export const bankAccountController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const items = await repo().find({ order: { created_at: 'ASC' } })
      res.json(items)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка загрузки счетов' })
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, bank_code, account_number, currency, opening_balance, opening_date } = req.body
      if (!name || !bank_code) { res.status(400).json({ error: 'name и bank_code обязательны' }); return }
      const item = repo().create({
        name, bank_code,
        account_number: account_number || null,
        currency: currency || 'RUB',
        opening_balance: opening_balance ?? 0,
        opening_date: opening_date || null,
        is_active: true,
      })
      const saved = await repo().save(item)
      res.status(201).json(saved)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const account = await repo().findOne({ where: { id } })
      if (!account) { res.status(404).json({ error: 'Не найден' }); return }
      const fields = ['name','bank_code','account_number','currency','opening_balance','opening_date','is_active'] as const
      for (const f of fields) if (req.body[f] !== undefined) (account as any)[f] = req.body[f]
      const saved = await repo().save(account)
      res.json(saved)
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const result = await repo().delete(id)
      if (result.affected === 0) { res.status(404).json({ error: 'Не найден' }); return }
      res.json({ success: true })
    } catch (err) {
      console.error(err); res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
```

**Step 2: Create routes**

`backend/src/routes/bankAccount.routes.ts`:
```typescript
import { Router } from 'express'
import { bankAccountController } from '../controllers/bankAccount.controller'

const router = Router()
router.get('/', bankAccountController.list)
router.post('/', bankAccountController.create)
router.put('/:id', bankAccountController.update)
router.delete('/:id', bankAccountController.remove)
export default router
```

**Step 3: Register routes in server.ts**

Edit `backend/src/server.ts`. Add import and registration:
```typescript
import bankAccountRoutes from './routes/bankAccount.routes'
// ... after other authenticated routes
app.use('/api/bank-accounts', authMiddleware, bankAccountRoutes)
```

**Step 4: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

**Step 5: Smoke test**

Start backend dev server (`cd backend && npm run dev` in separate terminal). Then:
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<your-email>","password":"<your-password>"}' | jq -r .token)

curl -s http://localhost:3001/api/bank-accounts -H "Authorization: Bearer $TOKEN" | jq
```
Expected: array with 2 seed accounts (Точка, Озон Банк).

**Step 6: Commit**

```bash
git add backend/src/controllers/bankAccount.controller.ts backend/src/routes/bankAccount.routes.ts backend/src/server.ts
git commit -m "feat(bdds): bank accounts CRUD API"
```

---

## Stage 2 — Bank Statement Parsers

### Task 2.1: Install xlsx + parser interface

**Files:**
- Modify: `backend/package.json` (add xlsx dependency)
- Create: `backend/src/services/bank-parsers/types.ts`
- Create: `backend/src/services/bank-parsers/index.ts`

**Step 1: Install xlsx**

```bash
cd backend && npm install xlsx@0.18.5
```

**Step 2: Create shared types**

`backend/src/services/bank-parsers/types.ts`:
```typescript
export interface NormalizedRow {
  external_id: string | null
  date: string                     // ISO YYYY-MM-DD
  type: 'income' | 'expense'
  amount: number                   // positive
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  raw: Record<string, any>
}

export interface ParseResult {
  rows: NormalizedRow[]
  period_start: string | null
  period_end: string | null
  bank_code: 'tochka' | 'ozon'
  warnings: string[]
}

export type ParserFn = (buffer: Buffer) => ParseResult
```

**Step 3: Create factory + auto-detect**

`backend/src/services/bank-parsers/index.ts`:
```typescript
import * as XLSX from 'xlsx'
import { ParseResult, NormalizedRow } from './types'
import { parseTochka } from './tochka.parser'
import { parseOzon } from './ozon.parser'

export type BankCode = 'tochka' | 'ozon'

export function detectBank(buffer: Buffer): BankCode | null {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  // Ozon: first sheet name === "Выписка", row 1 contains "ОЗОН БАНК"
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][]
    const head = JSON.stringify(aoa.slice(0, 5)).toUpperCase()
    if (head.includes('ОЗОН БАНК')) return 'ozon'
    if (name.toLowerCase().startsWith('операции')) return 'tochka'
  }
  return null
}

export function parse(buffer: Buffer, bank?: BankCode): ParseResult {
  const detected = bank || detectBank(buffer)
  if (!detected) throw new Error('Не удалось определить банк по файлу. Укажите счёт вручную.')

  if (detected === 'tochka') return parseTochka(buffer)
  if (detected === 'ozon')   return parseOzon(buffer)
  throw new Error(`Парсер для банка '${detected}' не реализован`)
}

export { NormalizedRow, ParseResult }
```

**Step 4: TypeScript build (will fail — parser files not yet created)**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
```
Expected: errors about missing `./tochka.parser` and `./ozon.parser` — that's fine, fixed in next tasks.

**Step 5: Commit (partial)**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/bank-parsers/types.ts backend/src/services/bank-parsers/index.ts
git commit -m "feat(bdds): xlsx dependency + parser interface and factory"
```

---

### Task 2.2: Tochka parser

**Files:**
- Create: `backend/src/services/bank-parsers/tochka.parser.ts`

**Step 1: Implement Tochka parser**

`backend/src/services/bank-parsers/tochka.parser.ts`:
```typescript
import * as XLSX from 'xlsx'
import { NormalizedRow, ParseResult } from './types'

// Tochka column header keywords (search by substring, case-insensitive)
const TOCHKA_COLS = {
  document_number: ['номер документа'],
  date_doc:        ['дата документа'],
  date_op:         ['дата операции'],
  counterparty:    ['контрагент'],
  inn:             ['инн контрагента', 'инн'],
  debit:           ['списание'],
  credit:          ['зачисление'],
  description:     ['назначение платежа', 'назначение'],
}

function findColumnIndex(headers: any[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim()
    for (const kw of keywords) {
      if (h.includes(kw.toLowerCase())) return i
    }
  }
  return -1
}

function normalizeDate(value: any): string | null {
  if (value == null) return null
  // Excel datetime
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  // ISO-ish string
  const s = String(value).trim()
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // DD.MM.YYYY
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseAmount(value: any): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

export function parseTochka(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // Find sheet starting with "Операции"
  const opsSheetName = wb.SheetNames.find(n => n.toLowerCase().startsWith('операции'))
  if (!opsSheetName) throw new Error('Лист «Операции» не найден')

  const ws = wb.Sheets[opsSheetName]
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true }) as any[][]

  // Headers in row 2 (index 1)
  const headers = aoa[1] || []
  const cols = {
    docNum:   findColumnIndex(headers, TOCHKA_COLS.document_number),
    dateDoc:  findColumnIndex(headers, TOCHKA_COLS.date_doc),
    dateOp:   findColumnIndex(headers, TOCHKA_COLS.date_op),
    cp:       findColumnIndex(headers, TOCHKA_COLS.counterparty),
    inn:      findColumnIndex(headers, TOCHKA_COLS.inn),
    debit:    findColumnIndex(headers, TOCHKA_COLS.debit),
    credit:   findColumnIndex(headers, TOCHKA_COLS.credit),
    desc:     findColumnIndex(headers, TOCHKA_COLS.description),
  }

  if (cols.dateDoc < 0 || cols.cp < 0 || cols.debit < 0 || cols.credit < 0) {
    throw new Error('Не найдены обязательные колонки (дата/контрагент/списание/зачисление)')
  }

  const rows: NormalizedRow[] = []
  const warnings: string[] = []
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  for (let i = 2; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.length === 0) continue

    const date = normalizeDate(row[cols.dateOp >= 0 ? cols.dateOp : cols.dateDoc])
    if (!date) { warnings.push(`Строка ${i+1}: нет даты, пропуск`); continue }

    const debit = parseAmount(row[cols.debit])
    const credit = parseAmount(row[cols.credit])
    if (debit === 0 && credit === 0) { warnings.push(`Строка ${i+1}: нулевая сумма, пропуск`); continue }

    const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense'
    const amount = credit > 0 ? credit : debit
    const cpName = String(row[cols.cp] || '').replace(/\n/g, ' ').trim()
    const innRaw = cols.inn >= 0 ? String(row[cols.inn] || '').trim() : ''
    const inn = /^\d{10,12}$/.test(innRaw) ? innRaw : null
    const desc = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : ''
    const docNum = cols.docNum >= 0 ? String(row[cols.docNum] || '').trim() || null : null

    rows.push({
      external_id: docNum,
      date,
      type,
      amount,
      counterparty_name: cpName,
      counterparty_inn: inn,
      description: desc,
      raw: { row_index: i + 1, header: headers, values: row },
    })

    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  return {
    rows,
    period_start: rows.length ? minDate : null,
    period_end:   rows.length ? maxDate : null,
    bank_code: 'tochka',
    warnings,
  }
}
```

**Step 2: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```
Expected: still missing ozon parser, but tochka.parser.ts itself is clean.

**Step 3: Commit**

```bash
git add backend/src/services/bank-parsers/tochka.parser.ts
git commit -m "feat(bdds): Tochka bank statement parser"
```

---

### Task 2.3: Ozon parser

**Files:**
- Create: `backend/src/services/bank-parsers/ozon.parser.ts`

**Step 1: Implement Ozon parser**

`backend/src/services/bank-parsers/ozon.parser.ts`:
```typescript
import * as XLSX from 'xlsx'
import { NormalizedRow, ParseResult } from './types'

// Ozon column header keywords
const OZON_COLS = {
  date:        ['дата'],
  doc_number:  ['номер документа'],
  debit:       ['дебет'],
  credit:      ['кредит'],
  counterparty:['контрагент'],
  description: ['назначение платежа'],
}

function findColumnIndex(headers: any[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim()
    for (const kw of keywords) {
      if (h.includes(kw.toLowerCase())) return i
    }
  }
  return -1
}

function normalizeDate(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function parseAmount(value: any): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.').replace(/\s/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

function extractInn(text: string): string | null {
  const m = text.match(/инн[:\s]*(\d{10,12})/i)
  return m ? m[1] : null
}

function extractName(cellText: string): string {
  // Cell example: "ООО Интернет Решения\nИНН:7704217370"
  const lines = String(cellText || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  // First non-INN line is the name
  for (const line of lines) {
    if (!/^инн[:\s]/i.test(line)) return line
  }
  return lines[0] || ''
}

function findHeaderRow(aoa: any[][]): number {
  // Row containing "Дата" + "Дебет" + "Кредит" — that's the headers row
  for (let i = 0; i < Math.min(aoa.length, 25); i++) {
    const row = aoa[i] || []
    const joined = row.map(c => String(c || '').toLowerCase()).join('|')
    if (joined.includes('дата') && joined.includes('дебет') && joined.includes('кредит')) {
      return i
    }
  }
  return -1
}

export function parseOzon(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const sheetName = wb.SheetNames.find(n => n.toLowerCase().startsWith('выписка')) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true }) as any[][]

  const headerRowIdx = findHeaderRow(aoa)
  if (headerRowIdx < 0) throw new Error('Не найдена строка заголовков Озон-выписки')

  const headers = aoa[headerRowIdx] || []
  const cols = {
    date:    findColumnIndex(headers, OZON_COLS.date),
    docNum:  findColumnIndex(headers, OZON_COLS.doc_number),
    debit:   findColumnIndex(headers, OZON_COLS.debit),
    credit:  findColumnIndex(headers, OZON_COLS.credit),
    cp:      findColumnIndex(headers, OZON_COLS.counterparty),
    desc:    findColumnIndex(headers, OZON_COLS.description),
  }

  if (cols.date < 0 || cols.debit < 0 || cols.credit < 0 || cols.cp < 0) {
    throw new Error('Озон: не найдены обязательные колонки (дата/дебет/кредит/контрагент)')
  }

  const rows: NormalizedRow[] = []
  const warnings: string[] = []
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  // Data starts 2 rows after header (sub-header row in between)
  const dataStart = headerRowIdx + 2

  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.length === 0) continue

    const date = normalizeDate(row[cols.date])
    if (!date) continue

    const debit = parseAmount(row[cols.debit])
    const credit = parseAmount(row[cols.credit])
    if (debit === 0 && credit === 0) { warnings.push(`Строка ${i+1}: нулевая сумма, пропуск`); continue }

    const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense'
    const amount = credit > 0 ? credit : debit
    const cpCellText = String(row[cols.cp] || '')
    const cpName = extractName(cpCellText)
    const inn = extractInn(cpCellText)
    const desc = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : ''
    const docNum = cols.docNum >= 0 ? String(row[cols.docNum] || '').trim() || null : null

    rows.push({
      external_id: docNum,
      date,
      type,
      amount,
      counterparty_name: cpName,
      counterparty_inn: inn,
      description: desc,
      raw: { row_index: i + 1, values: row },
    })

    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  return {
    rows,
    period_start: rows.length ? minDate : null,
    period_end:   rows.length ? maxDate : null,
    bank_code: 'ozon',
    warnings,
  }
}
```

**Step 2: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```
Expected: clean compile.

**Step 3: Commit**

```bash
git add backend/src/services/bank-parsers/ozon.parser.ts
git commit -m "feat(bdds): Ozon Bank statement parser"
```

---

### Task 2.4: Parser smoke test on real files

**Files:**
- Create: `backend/scripts/test-parsers.ts` (one-off, not committed permanently)

**Step 1: Write smoke test script**

`backend/scripts/test-parsers.ts`:
```typescript
import * as fs from 'fs'
import { parse, detectBank } from '../src/services/bank-parsers'

const files = [
  '/Users/vasilijaistov/Desktop/Архив с выпиской (12.04.2023 - 26.04.2026)/40802810220000929747 044525104 (01.01.2026 - 26.04.2026).xlsx',
  '/Users/vasilijaistov/Desktop/receipt_12.12.2023_26.04.2026.xlsx',
]

for (const f of files) {
  console.log('\n========== ' + f.split('/').pop())
  const buf = fs.readFileSync(f)
  const detected = detectBank(buf)
  console.log('detected bank:', detected)
  const result = parse(buf)
  console.log('rows:', result.rows.length)
  console.log('period:', result.period_start, '→', result.period_end)
  console.log('warnings:', result.warnings.length)
  console.log('first 3 rows:')
  for (const r of result.rows.slice(0, 3)) {
    console.log(' ', r.date, r.type, r.amount, '|', r.counterparty_name.slice(0, 40), '| INN:', r.counterparty_inn)
  }
}
```

**Step 2: Run it**

```bash
cd backend && npx tsx scripts/test-parsers.ts 2>&1 | head -40
```
(If `tsx` isn't installed: `npm install -D tsx`.)

Expected output (numbers approximate):
- Tochka file: detected `tochka`, ~12 rows, period 2026-03-03 → 2026-04-XX, 0 warnings
- Ozon file: detected `ozon`, ~230 rows, period 2023-12-25 → 2026-04-XX, possibly some warnings

If row counts look way off or dates are wrong, debug column detection by logging `headers` and `cols`.

**Step 3: Delete script (not committed)**

```bash
rm backend/scripts/test-parsers.ts
```

**Step 4: No commit needed for this verification step.**

---

## Stage 3 — Import API + Rules Engine

### Task 3.1: Rules matching service

**Files:**
- Create: `backend/src/services/import-matcher.ts`

**Step 1: Implement matcher**

`backend/src/services/import-matcher.ts`:
```typescript
import { AppDataSource } from '../config/database'
import { ImportRule } from '../entities/ImportRule'
import { Counterparty } from '../entities/Counterparty'
import { Category } from '../entities/Category'
import { NormalizedRow } from './bank-parsers/types'

export interface MatchSuggestion {
  counterparty_id: string | null
  counterparty_name: string | null
  category_id: string | null
  category_name: string | null
  is_inter_transfer: boolean
  matched_rule_id: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
}

export async function suggestMatch(row: NormalizedRow): Promise<MatchSuggestion> {
  const ruleRepo = AppDataSource.getRepository(ImportRule)
  const cpRepo   = AppDataSource.getRepository(Counterparty)
  const catRepo  = AppDataSource.getRepository(Category)

  // 1. By INN — most reliable
  if (row.counterparty_inn) {
    const rule = await ruleRepo.findOne({
      where: { match_type: 'inn', match_value: row.counterparty_inn },
    })
    if (rule) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'inn',
      }
    }
    // Direct counterparty match by INN even if no rule
    const cp = await cpRepo.findOne({ where: { inn: row.counterparty_inn } })
    if (cp) {
      return {
        counterparty_id: cp.id,
        counterparty_name: cp.name,
        category_id: null, category_name: null,
        is_inter_transfer: false, matched_rule_id: null,
        match_quality: 'inn',
      }
    }
  }

  // 2. By description keyword (substring match)
  const descRules = await ruleRepo.find({ where: { match_type: 'description_keyword' } })
  const descLower = row.description.toLowerCase()
  for (const rule of descRules) {
    if (descLower.includes(rule.match_value.toLowerCase())) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'description',
      }
    }
  }

  // 3. By name keyword
  const nameRules = await ruleRepo.find({ where: { match_type: 'name_keyword' } })
  const nameLower = row.counterparty_name.toLowerCase()
  for (const rule of nameRules) {
    if (nameLower.includes(rule.match_value.toLowerCase())) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'name',
      }
    }
  }

  return {
    counterparty_id: null, counterparty_name: null,
    category_id: null, category_name: null,
    is_inter_transfer: false, matched_rule_id: null,
    match_quality: 'none',
  }
}
```

**Step 2: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
```
Expected: clean (assuming `Counterparty` has `inn` field — check `backend/src/entities/Counterparty.ts` and adjust if it's different).

**Step 3: Commit**

```bash
git add backend/src/services/import-matcher.ts
git commit -m "feat(bdds): rule-based import matcher (INN/name/description)"
```

---

### Task 3.2: Transfer detection service

**Files:**
- Create: `backend/src/services/transfer-detector.ts`

**Step 1: Implement detector**

`backend/src/services/transfer-detector.ts`:
```typescript
import { AppDataSource } from '../config/database'
import { Transaction } from '../entities/Transaction'
import { NormalizedRow } from './bank-parsers/types'
import { Between, Not, IsNull } from 'typeorm'

export interface TransferMatch {
  matched_transaction_id: string
  matched_bank_account_id: string
}

/**
 * Look for a mirror transaction in the database that matches this row but
 * on a DIFFERENT bank account: same amount, opposite type, date ±2 days.
 */
export async function detectTransfer(
  row: NormalizedRow,
  importingAccountId: string,
): Promise<TransferMatch | null> {
  const txRepo = AppDataSource.getRepository(Transaction)

  const date = new Date(row.date)
  const from = new Date(date.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const to   = new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const oppositeType = row.type === 'income' ? 'expense' : 'income'

  const candidates = await txRepo.find({
    where: {
      type: oppositeType as any,
      amount: row.amount as any,
      date: Between(from, to) as any,
      bank_account_id: Not(importingAccountId) as any,
      is_inter_account_transfer: false as any,
    },
    take: 5,
  })

  // Prefer the closest date
  if (candidates.length === 0) return null
  candidates.sort((a, b) =>
    Math.abs(new Date(a.date as any).getTime() - date.getTime()) -
    Math.abs(new Date(b.date as any).getTime() - date.getTime())
  )

  const match = candidates[0]
  return {
    matched_transaction_id: match.id,
    matched_bank_account_id: (match as any).bank_account_id,
  }
}
```

**Step 2: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
```
Expected: clean. If `Transaction.amount` field type doesn't accept comparison literally (depends on TypeORM version), use raw query instead — but `Between` + scalar should work.

**Step 3: Commit**

```bash
git add backend/src/services/transfer-detector.ts
git commit -m "feat(bdds): inter-account transfer detector"
```

---

### Task 3.3: Import controller — preview endpoint

**Files:**
- Create: `backend/src/controllers/bankImport.controller.ts`
- Create: `backend/src/routes/bankImport.routes.ts`
- Modify: `backend/src/server.ts`
- Install: `multer` (file upload middleware)

**Step 1: Install multer**

```bash
cd backend && npm install multer @types/multer
```

**Step 2: Implement controller — preview only (commit endpoint added in next task)**

`backend/src/controllers/bankImport.controller.ts`:
```typescript
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { BankAccount } from '../entities/BankAccount'
import { Transaction } from '../entities/Transaction'
import { parse, detectBank, BankCode } from '../services/bank-parsers'
import { suggestMatch } from '../services/import-matcher'
import { detectTransfer } from '../services/transfer-detector'

export interface PreviewRowOut {
  index: number
  external_id: string | null
  date: string
  type: 'income' | 'expense'
  amount: number
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  // Suggestions
  suggested_counterparty_id: string | null
  suggested_counterparty_name: string | null
  suggested_category_id: string | null
  suggested_category_name: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
  matched_rule_id: string | null
  // Flags
  is_duplicate: boolean
  is_transfer: boolean
  transfer_match_id: string | null
}

export interface PreviewResponse {
  bank_code: BankCode
  bank_account_id: string
  period_start: string | null
  period_end: string | null
  total_rows: number
  warnings: string[]
  rows: PreviewRowOut[]
}

export const bankImportController = {
  async preview(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { res.status(400).json({ error: 'Файл не передан' }); return }

      const file = req.file
      let bankAccountId = req.body.bank_account_id as string | undefined
      let bankCode = req.body.bank_code as BankCode | undefined

      // Auto-detect bank if not specified
      if (!bankCode) {
        const detected = detectBank(file.buffer)
        if (!detected) { res.status(400).json({ error: 'Не удалось определить банк по файлу. Укажите счёт.' }); return }
        bankCode = detected
      }

      // Resolve bank_account by code if not specified
      if (!bankAccountId) {
        const acc = await AppDataSource.getRepository(BankAccount).findOne({ where: { bank_code: bankCode, is_active: true } })
        if (!acc) { res.status(404).json({ error: `Счёт для банка ${bankCode} не найден` }); return }
        bankAccountId = acc.id
      }

      const result = parse(file.buffer, bankCode)

      // Pre-fetch existing external_ids for this account to flag duplicates
      const txRepo = AppDataSource.getRepository(Transaction)
      const externalIds = result.rows.map(r => r.external_id).filter(Boolean) as string[]
      const existing = externalIds.length === 0
        ? []
        : await txRepo.createQueryBuilder('t')
            .where('t.bank_account_id = :acc', { acc: bankAccountId })
            .andWhere('t.external_id IN (:...ids)', { ids: externalIds })
            .select(['t.external_id'])
            .getMany()
      const existingSet = new Set(existing.map(t => t.external_id))

      // Build preview rows in parallel chunks of 25 (limit DB pressure)
      const out: PreviewRowOut[] = []
      const CHUNK = 25
      for (let i = 0; i < result.rows.length; i += CHUNK) {
        const chunk = result.rows.slice(i, i + CHUNK)
        const enriched = await Promise.all(chunk.map(async (row, idx) => {
          const sug = await suggestMatch(row)
          const transfer = sug.is_inter_transfer
            ? null
            : await detectTransfer(row, bankAccountId!)
          return {
            index: i + idx,
            external_id: row.external_id,
            date: row.date,
            type: row.type,
            amount: row.amount,
            counterparty_name: row.counterparty_name,
            counterparty_inn: row.counterparty_inn,
            description: row.description,
            suggested_counterparty_id: sug.counterparty_id,
            suggested_counterparty_name: sug.counterparty_name,
            suggested_category_id: sug.category_id,
            suggested_category_name: sug.category_name,
            match_quality: sug.match_quality,
            matched_rule_id: sug.matched_rule_id,
            is_duplicate: row.external_id ? existingSet.has(row.external_id) : false,
            is_transfer: sug.is_inter_transfer || !!transfer,
            transfer_match_id: transfer?.matched_transaction_id || null,
          } as PreviewRowOut
        }))
        out.push(...enriched)
      }

      const response: PreviewResponse = {
        bank_code: result.bank_code,
        bank_account_id: bankAccountId,
        period_start: result.period_start,
        period_end:   result.period_end,
        total_rows: result.rows.length,
        warnings: result.warnings,
        rows: out,
      }
      res.json(response)
    } catch (err: any) {
      console.error('[bankImport.preview]', err)
      res.status(500).json({ error: err.message || 'Ошибка превью' })
    }
  },

  async commit(_req: Request, _res: Response): Promise<void> {
    // implemented in Task 3.4
  },
}
```

**Step 3: Create routes**

`backend/src/routes/bankImport.routes.ts`:
```typescript
import { Router } from 'express'
import multer from 'multer'
import { bankImportController } from '../controllers/bankImport.controller'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
})

const router = Router()
router.post('/preview', upload.single('file'), bankImportController.preview)
router.post('/commit', bankImportController.commit)
export default router
```

**Step 4: Register routes in server.ts**

```typescript
import bankImportRoutes from './routes/bankImport.routes'
app.use('/api/bank-imports', authMiddleware, bankImportRoutes)
```

**Step 5: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```
Expected: clean.

**Step 6: Smoke test preview**

With backend running:
```bash
TOKEN=...  # auth token from earlier
curl -s -X POST http://localhost:3001/api/bank-imports/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/Users/vasilijaistov/Desktop/Архив с выпиской (12.04.2023 - 26.04.2026)/40802810220000929747 044525104 (01.01.2026 - 26.04.2026).xlsx" \
  | jq '.total_rows, .period_start, .period_end, (.rows | length), (.rows[0])'
```
Expected: total_rows ~12, period 2026-03-03 → 2026-04-XX, first row with all suggestion fields populated (probably `match_quality: "none"` until we have rules).

**Step 7: Commit**

```bash
git add backend/src/controllers/bankImport.controller.ts backend/src/routes/bankImport.routes.ts backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(bdds): bank import preview endpoint with multer + matcher"
```

---

### Task 3.4: Import controller — commit endpoint

**Files:**
- Modify: `backend/src/controllers/bankImport.controller.ts` (replace `commit` stub)

**Step 1: Implement commit**

Replace the `commit` stub with the full implementation. Add at top:
```typescript
import { BankImport } from '../entities/BankImport'
import { ImportRule } from '../entities/ImportRule'
import { Counterparty } from '../entities/Counterparty'
```

Replace `commit` method body:
```typescript
async commit(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId
    const {
      bank_account_id,
      file_name,
      period_start,
      period_end,
      rows,             // array of confirmed PreviewRowOut + manual edits
      rules_to_create,  // array of { match_type, match_value, counterparty_id, category_id, is_inter_transfer }
    } = req.body as {
      bank_account_id: string
      file_name: string
      period_start: string | null
      period_end: string | null
      rows: Array<{
        external_id: string | null
        date: string
        type: 'income' | 'expense'
        amount: number
        counterparty_name: string
        counterparty_inn: string | null
        description: string
        counterparty_id: string | null
        category_id: string | null
        is_transfer: boolean
        transfer_match_id: string | null
        skip: boolean       // user can skip duplicates / unwanted rows
      }>
      rules_to_create: Array<{
        match_type: 'inn' | 'name_keyword' | 'description_keyword'
        match_value: string
        counterparty_id: string | null
        category_id: string | null
        is_inter_transfer: boolean
      }>
    }

    if (!bank_account_id || !Array.isArray(rows)) {
      res.status(400).json({ error: 'bank_account_id и rows обязательны' }); return
    }

    const importRepo = AppDataSource.getRepository(BankImport)
    const txRepo     = AppDataSource.getRepository(Transaction)
    const cpRepo     = AppDataSource.getRepository(Counterparty)
    const ruleRepo   = AppDataSource.getRepository(ImportRule)

    // Create import session
    const session = importRepo.create({
      bank_account_id,
      file_name: file_name || 'unknown.xlsx',
      period_start, period_end,
      total_rows: rows.length,
      imported_rows: 0,
      skipped_duplicates: 0,
      status: 'pending',
      imported_by: userId || null,
    })
    const savedSession = await importRepo.save(session)

    let importedRows = 0
    let skipped = 0
    const transferLinks: Array<{ a: string; b: string }> = []

    for (const r of rows) {
      if (r.skip) { skipped++; continue }

      // Auto-create counterparty if name given but no FK
      let counterpartyId = r.counterparty_id
      if (!counterpartyId && r.counterparty_name) {
        const newCp = cpRepo.create({
          name: r.counterparty_name,
          inn: r.counterparty_inn || null,
        } as any)
        const savedCp = await cpRepo.save(newCp)
        counterpartyId = (savedCp as any).id
      }

      const tx = txRepo.create({
        date: r.date,
        type: r.type,
        amount: r.amount,
        counterparty_id: counterpartyId,
        category_id: r.category_id,
        bank_account_id,
        import_id: savedSession.id,
        external_id: r.external_id,
        raw_description: r.description,
        is_inter_account_transfer: r.is_transfer,
        linked_transfer_id: r.transfer_match_id || null,
      } as any)
      const savedTx = await txRepo.save(tx)
      importedRows++

      // If this row is a transfer matched against an existing tx, link both ways
      if (r.is_transfer && r.transfer_match_id) {
        await txRepo.update(r.transfer_match_id, {
          is_inter_account_transfer: true,
          linked_transfer_id: (savedTx as any).id,
        } as any)
        transferLinks.push({ a: (savedTx as any).id, b: r.transfer_match_id })
      }
    }

    // Persist learned rules (upsert by match_type + match_value)
    for (const rule of rules_to_create || []) {
      if (!rule.match_value) continue
      const existing = await ruleRepo.findOne({
        where: { match_type: rule.match_type, match_value: rule.match_value },
      })
      if (existing) {
        existing.counterparty_id = rule.counterparty_id || existing.counterparty_id
        existing.category_id = rule.category_id || existing.category_id
        existing.is_inter_transfer = rule.is_inter_transfer || existing.is_inter_transfer
        existing.hit_count = (existing.hit_count || 0) + 1
        existing.last_used_at = new Date()
        await ruleRepo.save(existing)
      } else {
        const created = ruleRepo.create({
          ...rule,
          hit_count: 1,
          last_used_at: new Date(),
        } as any)
        await ruleRepo.save(created)
      }
    }

    // Finalize session
    await importRepo.update(savedSession.id, {
      imported_rows: importedRows,
      skipped_duplicates: skipped,
      status: 'completed',
    } as any)

    res.json({
      import_id: savedSession.id,
      imported_rows: importedRows,
      skipped: skipped,
      transfer_links: transferLinks.length,
    })
  } catch (err: any) {
    console.error('[bankImport.commit]', err)
    res.status(500).json({ error: err.message || 'Ошибка импорта' })
  }
},
```

**Step 2: TypeScript build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```

If you get errors about `Counterparty.create({ name, inn })` — read `backend/src/entities/Counterparty.ts` and use the actual field names.

**Step 3: Smoke test commit (with a tiny payload)**

```bash
curl -s -X POST http://localhost:3001/api/bank-imports/commit \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "bank_account_id": "<UUID-of-tochka-from-earlier>",
    "file_name": "smoke.xlsx",
    "period_start": "2026-04-01",
    "period_end": "2026-04-30",
    "rows": [{
      "external_id": "TEST-1",
      "date": "2026-04-15",
      "type": "expense",
      "amount": 100,
      "counterparty_name": "ООО Тест",
      "counterparty_inn": "1234567890",
      "description": "Тестовая операция",
      "counterparty_id": null,
      "category_id": null,
      "is_transfer": false,
      "transfer_match_id": null,
      "skip": false
    }],
    "rules_to_create": []
  }' | jq
```
Expected: `{ import_id, imported_rows: 1, skipped: 0, transfer_links: 0 }`. Check `transactions` table → row exists with import_id and external_id="TEST-1".

Cleanup: `DELETE FROM transactions WHERE external_id = 'TEST-1';` via Supabase MCP.

**Step 4: Commit**

```bash
git add backend/src/controllers/bankImport.controller.ts
git commit -m "feat(bdds): bank import commit endpoint with rule learning + transfer linking"
```

---

### Task 3.5: Import rules CRUD (list + delete)

**Files:**
- Create: `backend/src/controllers/importRule.controller.ts`
- Create: `backend/src/routes/importRule.routes.ts`
- Modify: `backend/src/server.ts`

**Step 1: Controller**

`backend/src/controllers/importRule.controller.ts`:
```typescript
import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { ImportRule } from '../entities/ImportRule'

const repo = () => AppDataSource.getRepository(ImportRule)

export const importRuleController = {
  async list(_req: Request, res: Response): Promise<void> {
    const items = await repo().createQueryBuilder('r')
      .leftJoinAndMapOne('r.counterparty', 'counterparties', 'cp', 'cp.id = r.counterparty_id')
      .leftJoinAndMapOne('r.category', 'categories', 'cat', 'cat.id = r.category_id')
      .orderBy('r.last_used_at', 'DESC', 'NULLS LAST')
      .getMany()
    res.json(items)
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const result = await repo().delete(id)
    if (result.affected === 0) { res.status(404).json({ error: 'Не найдено' }); return }
    res.json({ success: true })
  },
}
```

**Step 2: Routes + register**

`backend/src/routes/importRule.routes.ts`:
```typescript
import { Router } from 'express'
import { importRuleController } from '../controllers/importRule.controller'
const router = Router()
router.get('/', importRuleController.list)
router.delete('/:id', importRuleController.remove)
export default router
```

`backend/src/server.ts`:
```typescript
import importRuleRoutes from './routes/importRule.routes'
app.use('/api/import-rules', authMiddleware, importRuleRoutes)
```

**Step 3: Build + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
git add backend/src/controllers/importRule.controller.ts backend/src/routes/importRule.routes.ts backend/src/server.ts
git commit -m "feat(bdds): import rules list/delete API"
```

---

## Stage 4 — Import UI (Frontend)

### Task 4.1: Frontend API module + types

**Files:**
- Create: `frontend/src/api/bankImports.ts`
- Create: `frontend/src/api/bankAccounts.ts`
- Create: `frontend/src/api/importRules.ts`

**Step 1: Bank accounts API**

`frontend/src/api/bankAccounts.ts`:
```typescript
import { apiClient as api } from './client'

export interface BankAccount {
  id: string
  name: string
  bank_code: string
  account_number: string | null
  currency: string
  opening_balance: number
  opening_date: string | null
  is_active: boolean
}

export const bankAccountsApi = {
  list:   (): Promise<BankAccount[]> => api.get('/bank-accounts').then(r => r.data),
  create: (d: Partial<BankAccount>): Promise<BankAccount> => api.post('/bank-accounts', d).then(r => r.data),
  update: (id: string, d: Partial<BankAccount>): Promise<BankAccount> => api.put(`/bank-accounts/${id}`, d).then(r => r.data),
  remove: (id: string): Promise<void> => api.delete(`/bank-accounts/${id}`).then(() => {}),
}
```

**Step 2: Bank imports API**

`frontend/src/api/bankImports.ts`:
```typescript
import { apiClient as api } from './client'

export interface PreviewRow {
  index: number
  external_id: string | null
  date: string
  type: 'income' | 'expense'
  amount: number
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  suggested_counterparty_id: string | null
  suggested_counterparty_name: string | null
  suggested_category_id: string | null
  suggested_category_name: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
  matched_rule_id: string | null
  is_duplicate: boolean
  is_transfer: boolean
  transfer_match_id: string | null
}

export interface PreviewResponse {
  bank_code: 'tochka' | 'ozon'
  bank_account_id: string
  period_start: string | null
  period_end: string | null
  total_rows: number
  warnings: string[]
  rows: PreviewRow[]
}

export interface CommitRow {
  external_id: string | null
  date: string
  type: 'income' | 'expense'
  amount: number
  counterparty_name: string
  counterparty_inn: string | null
  description: string
  counterparty_id: string | null
  category_id: string | null
  is_transfer: boolean
  transfer_match_id: string | null
  skip: boolean
}

export interface RuleToCreate {
  match_type: 'inn' | 'name_keyword' | 'description_keyword'
  match_value: string
  counterparty_id: string | null
  category_id: string | null
  is_inter_transfer: boolean
}

export const bankImportsApi = {
  preview: (file: File, bankAccountId?: string): Promise<PreviewResponse> => {
    const fd = new FormData()
    fd.append('file', file)
    if (bankAccountId) fd.append('bank_account_id', bankAccountId)
    return api.post('/bank-imports/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  commit: (data: {
    bank_account_id: string
    file_name: string
    period_start: string | null
    period_end: string | null
    rows: CommitRow[]
    rules_to_create: RuleToCreate[]
  }): Promise<{ import_id: string; imported_rows: number; skipped: number; transfer_links: number }> =>
    api.post('/bank-imports/commit', data).then(r => r.data),
}
```

**Step 3: Import rules API**

`frontend/src/api/importRules.ts`:
```typescript
import { apiClient as api } from './client'

export interface ImportRule {
  id: string
  match_type: string
  match_value: string
  counterparty_id: string | null
  category_id: string | null
  is_inter_transfer: boolean
  hit_count: number
  last_used_at: string | null
  counterparty?: { id: string; name: string }
  category?: { id: string; name: string }
}

export const importRulesApi = {
  list:   (): Promise<ImportRule[]> => api.get('/import-rules').then(r => r.data),
  remove: (id: string): Promise<void> => api.delete(`/import-rules/${id}`).then(() => {}),
}
```

**Step 4: TypeScript build + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -5
git add frontend/src/api/bankAccounts.ts frontend/src/api/bankImports.ts frontend/src/api/importRules.ts
git commit -m "feat(bdds): frontend API modules for bank accounts/imports/rules"
```

---

### Task 4.2: Bank Import page — upload + preview shell

**Files:**
- Create: `frontend/src/pages/BankImport.tsx`
- Modify: `frontend/src/App.tsx` (add route + lazy import)
- Modify: `frontend/src/components/Layout.tsx` (add nav link under Финансы)

**Step 1: Create page skeleton**

`frontend/src/pages/BankImport.tsx`:
```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { bankImportsApi, PreviewResponse, PreviewRow, CommitRow, RuleToCreate } from '../api/bankImports'
import { bankAccountsApi, BankAccount } from '../api/bankAccounts'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'

export default function BankImport() {
  const toast = useToast()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')   // empty = auto-detect
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [committing, setCommitting] = useState(false)

  // Per-row UI state (edited fields, learn flag, skip flag)
  type RowState = {
    counterparty_id: string | null
    counterparty_name: string
    counterparty_inn: string | null
    category_id: string | null
    is_transfer: boolean
    transfer_match_id: string | null
    skip: boolean
    learn: boolean
  }
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})

  useEffect(() => { bankAccountsApi.list().then(setAccounts).catch(console.error) }, [])

  // When preview arrives, init row states
  useEffect(() => {
    if (!preview) return
    const states: Record<number, RowState> = {}
    for (const r of preview.rows) {
      states[r.index] = {
        counterparty_id: r.suggested_counterparty_id,
        counterparty_name: r.counterparty_name,
        counterparty_inn: r.counterparty_inn,
        category_id: r.suggested_category_id,
        is_transfer: r.is_transfer,
        transfer_match_id: r.transfer_match_id,
        skip: r.is_duplicate,
        learn: r.match_quality === 'none',  // by default learn for new mappings
      }
    }
    setRowStates(states)
  }, [preview])

  const onFileSelect = (f: File) => {
    setFile(f)
    setPreview(null)
  }

  const runPreview = async () => {
    if (!file) return
    setLoadingPreview(true)
    try {
      const r = await bankImportsApi.preview(file, selectedAccount || undefined)
      setPreview(r)
      toast.success(`Распарсено ${r.total_rows} строк`)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка парсинга')
    } finally { setLoadingPreview(false) }
  }

  const counts = useMemo(() => {
    if (!preview) return null
    let auto = 0, partial = 0, manual = 0, dup = 0, transfer = 0
    for (const r of preview.rows) {
      if (r.is_duplicate) dup++
      else if (r.is_transfer) transfer++
      else if (r.match_quality === 'inn' && r.suggested_category_id) auto++
      else if (r.suggested_counterparty_id || r.suggested_category_id) partial++
      else manual++
    }
    return { auto, partial, manual, dup, transfer }
  }, [preview])

  const commit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const rows: CommitRow[] = preview.rows.map(r => {
        const s = rowStates[r.index]
        return {
          external_id: r.external_id,
          date: r.date,
          type: r.type,
          amount: r.amount,
          counterparty_name: s.counterparty_name || r.counterparty_name,
          counterparty_inn: s.counterparty_inn,
          description: r.description,
          counterparty_id: s.counterparty_id,
          category_id: s.category_id,
          is_transfer: s.is_transfer,
          transfer_match_id: s.transfer_match_id,
          skip: s.skip,
        }
      })

      // Build rules to create from rows where `learn` is true and we have manual mapping
      const rules_to_create: RuleToCreate[] = []
      for (const r of preview.rows) {
        const s = rowStates[r.index]
        if (!s.learn || s.skip) continue
        if (!s.counterparty_id && !s.category_id && !s.is_transfer) continue

        if (r.counterparty_inn) {
          rules_to_create.push({
            match_type: 'inn',
            match_value: r.counterparty_inn,
            counterparty_id: s.counterparty_id,
            category_id: s.category_id,
            is_inter_transfer: s.is_transfer,
          })
        }
      }

      const result = await bankImportsApi.commit({
        bank_account_id: preview.bank_account_id,
        file_name: file?.name || 'unknown.xlsx',
        period_start: preview.period_start,
        period_end: preview.period_end,
        rows,
        rules_to_create,
      })
      toast.success(`Импортировано ${result.imported_rows} строк, правил создано: ${rules_to_create.length}`)
      navigate('/transactions')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Ошибка импорта')
    } finally { setCommitting(false) }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl sm:text-2xl font-bold text-brand-text mb-6">Импорт банковских выписок</h1>

      {/* Upload card */}
      <div className="bg-card border border-brand-border rounded-2xl p-5 mb-6">
        <h2 className="text-base font-semibold text-brand-text mb-3">1. Загрузка файла</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text"
          >
            <option value="">Автоопределение банка</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.bank_code})</option>
            ))}
          </select>
          <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text-secondary hover:border-primary-400">
            <FileSpreadsheet size={16} />
            <span className="truncate">{file?.name || 'Выбрать .xlsx файл'}</span>
            <input type="file" accept=".xlsx,.xls" hidden onChange={e => e.target.files && onFileSelect(e.target.files[0])} />
          </label>
          <button
            onClick={runPreview}
            disabled={!file || loadingPreview}
            className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {loadingPreview && <Loader2 size={16} className="animate-spin" />}
            <Upload size={16} />
            Проверить
          </button>
        </div>
      </div>

      {/* Preview area */}
      {preview && counts && (
        <div className="bg-card border border-brand-border rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-brand-text">2. Превью ({preview.total_rows} строк)</h2>
              <p className="text-xs text-brand-text-secondary mt-1">
                {preview.period_start} → {preview.period_end} · банк: {preview.bank_code}
              </p>
              <div className="flex gap-2 mt-2 text-xs flex-wrap">
                <span className="px-2 py-1 rounded bg-green-100 text-green-700">✓ авто: {counts.auto}</span>
                <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">⚠ частично: {counts.partial}</span>
                <span className="px-2 py-1 rounded bg-red-100 text-red-700">⛔ ручная разметка: {counts.manual}</span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">🔄 переводы: {counts.transfer}</span>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-600">❌ дубли: {counts.dup}</span>
              </div>
            </div>
            <button
              onClick={commit}
              disabled={committing}
              className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 flex items-center gap-2"
            >
              {committing && <Loader2 size={16} className="animate-spin" />}
              <CheckCircle2 size={16} />
              Импортировать {preview.total_rows - counts.dup} строк
            </button>
          </div>

          {/* TODO Task 4.3: actual preview table */}
          <p className="text-sm text-brand-text-secondary italic">
            Таблица превью будет добавлена в задаче 4.3.
          </p>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add route**

Edit `frontend/src/App.tsx`:
```typescript
const BankImport = lazy(() => import('./pages/BankImport'))
// In routes:
<Route path="/financial-reports/import" element={<BankImport />} />
```

**Step 3: Add nav link**

Edit `frontend/src/components/Layout.tsx`. Find where the financial reports nav item is and add a child or sibling link to `/financial-reports/import` (label: «Импорт выписок»).

**Step 4: Build + smoke test**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -5 && npm run build 2>&1 | tail -3
```

In browser: navigate to `/financial-reports/import`, upload a real Tochka .xlsx, click "Проверить". Should see counts populate and placeholder text.

**Step 5: Commit**

```bash
git add frontend/src/pages/BankImport.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(bdds): bank import page shell with upload + preview summary"
```

---

### Task 4.3: Preview table with row-level editing

This task is large; it has its own dedicated steps. **Files:**
- Modify: `frontend/src/pages/BankImport.tsx` (add `<PreviewTable>` component within the file or extract)
- Possibly create autocomplete component for counterparty/category if not already available

**Step 1: Check existing autocomplete/select components**

Run:
```bash
grep -rn "autocomplete\|Combobox\|Autocomplete" frontend/src/components/ 2>&1 | head -10
```

If no existing autocomplete component — implement a minimal inline `<select>` with the existing counterparties + a "+ Создать" button. Full autocomplete can come in Phase 2.

**Step 2: Replace the placeholder in BankImport.tsx with real table**

Add inside `BankImport.tsx` (replace the `{/* TODO Task 4.3 ... */}` block):

```tsx
{/* Preview table */}
<div className="overflow-x-auto -mx-2 sm:mx-0">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-brand-border text-xs text-brand-text-secondary">
        <th className="text-left px-2 py-2 w-8">☑</th>
        <th className="text-left px-2 py-2">Дата</th>
        <th className="text-right px-2 py-2">Сумма</th>
        <th className="text-left px-2 py-2">Контрагент</th>
        <th className="text-left px-2 py-2">→ ERP</th>
        <th className="text-left px-2 py-2">Категория</th>
        <th className="text-left px-2 py-2">Запомнить</th>
      </tr>
    </thead>
    <tbody>
      {preview.rows.map(r => {
        const s = rowStates[r.index]
        if (!s) return null
        const bg =
          s.skip ? 'opacity-40' :
          s.is_transfer ? 'bg-blue-50' :
          r.match_quality === 'inn' && s.category_id ? 'bg-green-50' :
          s.counterparty_id || s.category_id ? 'bg-amber-50' :
          'bg-red-50'
        return (
          <tr key={r.index} className={`border-b border-brand-border/50 ${bg}`}>
            <td className="px-2 py-2">
              <input
                type="checkbox"
                checked={!s.skip}
                onChange={e => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], skip: !e.target.checked } }))}
              />
            </td>
            <td className="px-2 py-2 whitespace-nowrap">{r.date}</td>
            <td className="px-2 py-2 text-right whitespace-nowrap">
              <span className={r.type === 'income' ? 'text-green-700' : 'text-red-700'}>
                {r.type === 'income' ? '+' : '−'}{r.amount.toLocaleString('ru-RU')} ₽
              </span>
            </td>
            <td className="px-2 py-2 max-w-[200px] truncate" title={r.counterparty_name}>
              {r.counterparty_name}
              {r.counterparty_inn && <span className="text-xs text-brand-text-secondary block">ИНН {r.counterparty_inn}</span>}
            </td>
            <td className="px-2 py-2">
              {s.is_transfer ? (
                <span className="text-xs text-blue-700">🔄 Перевод между счетами</span>
              ) : (
                <CounterpartySelect
                  value={s.counterparty_id}
                  onChange={cpId => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], counterparty_id: cpId } }))}
                />
              )}
            </td>
            <td className="px-2 py-2">
              {s.is_transfer ? (
                <span className="text-xs text-brand-text-secondary">—</span>
              ) : (
                <CategorySelect
                  value={s.category_id}
                  type={r.type}
                  onChange={catId => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], category_id: catId } }))}
                />
              )}
            </td>
            <td className="px-2 py-2">
              <label className="text-xs flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.learn}
                  disabled={!r.counterparty_inn}
                  onChange={e => setRowStates(prev => ({ ...prev, [r.index]: { ...prev[r.index], learn: e.target.checked } }))}
                />
                {r.counterparty_inn ? 'для ИНН' : '—'}
              </label>
            </td>
          </tr>
        )
      })}
    </tbody>
  </table>
</div>
```

Add minimal `CounterpartySelect` and `CategorySelect` components at the top of the same file (above `export default`):

```tsx
import { counterpartiesApi, Counterparty } from '../api/counterparties'
import { categoriesApi, Category } from '../api/categories'

function CounterpartySelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [items, setItems] = useState<Counterparty[]>([])
  useEffect(() => { counterpartiesApi.list().then(setItems).catch(console.error) }, [])
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="text-xs border border-brand-border rounded-lg px-2 py-1 bg-card max-w-[180px]"
    >
      <option value="">— выбрать —</option>
      {items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

function CategorySelect({ value, type, onChange }: { value: string | null; type: 'income'|'expense'; onChange: (id: string | null) => void }) {
  const [items, setItems] = useState<Category[]>([])
  useEffect(() => { categoriesApi.list().then(setItems).catch(console.error) }, [])
  const filtered = items.filter(c => c.type === type || !c.type)
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className="text-xs border border-brand-border rounded-lg px-2 py-1 bg-card max-w-[180px]"
    >
      <option value="">— выбрать —</option>
      {filtered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}
```

(Adjust import paths and field names to match the actual API — read `frontend/src/api/counterparties.ts` and `frontend/src/api/categories.ts` first.)

**Step 3: TypeScript build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

**Step 4: Browser smoke test**

Reload the page, upload a real .xlsx, verify:
- Coloured rows (green/amber/red/blue/grey based on match)
- Counterparty/Category selects work
- Skip checkbox toggles opacity
- "Импортировать N строк" button counts correctly

**Step 5: Commit**

```bash
git add frontend/src/pages/BankImport.tsx
git commit -m "feat(bdds): preview table with row-level editing + learn rules"
```

---

## Stage 5 — Subcategories Support

### Task 5.1: Backend — hierarchical category list

**Files:**
- Modify: `backend/src/controllers/category.controller.ts` (extend list query)

**Step 1: Read existing controller**

Read `backend/src/controllers/category.controller.ts` to understand the current list response shape.

**Step 2: Update list to include parent + cashflow_section**

In the `list` (or `getAll`) method, return extra fields:
```typescript
const categories = await AppDataSource.getRepository(Category).find({
  order: { name: 'ASC' },
})
// Map to response with explicit fields including cashflow_section + parent_id
res.json(categories.map(c => ({
  id: c.id,
  name: c.name,
  type: c.type,
  parent_id: (c as any).parent_id || null,
  cashflow_section: (c as any).cashflow_section || null,
})))
```

If category controller already returns full entities — only the entity itself needs parent_id and cashflow_section, which they have via Stage 1 entity changes.

**Step 3: Add update endpoint accepts these fields**

Find the `update` (or `put`) method. In the field whitelist, add:
```typescript
const fields = [..., 'parent_id', 'cashflow_section']
```

**Step 4: TypeScript build + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
git add backend/src/controllers/category.controller.ts
git commit -m "feat(bdds): expose parent_id and cashflow_section on categories API"
```

---

### Task 5.2: Frontend — Categories page with parent + section editing

**Files:**
- Modify: `frontend/src/api/categories.ts` (add fields to interface)
- Modify: `frontend/src/pages/Categories.tsx` (add columns/inputs for parent + cashflow_section)

**Step 1: Update API types**

In `frontend/src/api/categories.ts`, add to the `Category` interface:
```typescript
parent_id: string | null
cashflow_section: 'operational' | 'investing' | 'financing' | null
```

And in `update`/`create` payloads, allow these fields.

**Step 2: Update Categories.tsx**

Read current `frontend/src/pages/Categories.tsx`. Add to the row form/inline-edit:
- A `<select>` for parent category (showing only categories with no parent_id, exclude self)
- A `<select>` for cashflow_section with options: «Без раздела» / «Операционная» / «Инвестиционная» / «Финансовая»

Display in the row: indented child names (`├─ ChildName`), color-coded section badges (operational=green, investing=blue, financing=purple).

If Categories.tsx has a list view — sort to show parents first, then children indented under them:
```typescript
const tree = useMemo(() => {
  const parents = items.filter(c => !c.parent_id).sort((a,b) => a.name.localeCompare(b.name))
  const out: Category[] = []
  for (const p of parents) {
    out.push(p)
    items.filter(c => c.parent_id === p.id).sort((a,b) => a.name.localeCompare(b.name)).forEach(c => out.push(c))
  }
  return out
}, [items])
```

**Step 3: Build + smoke test in browser**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -5
```

In browser: navigate `/categories`, edit one category, set parent & cashflow_section, save, reload — values persist.

**Step 4: Commit**

```bash
git add frontend/src/api/categories.ts frontend/src/pages/Categories.tsx
git commit -m "feat(bdds): subcategories + cashflow section UI on Categories page"
```

---

## Stage 6 — БДДС / Cashflow Report

### Task 6.1: Cashflow service — aggregation logic

**Files:**
- Create: `backend/src/services/cashflow.service.ts`

**Step 1: Implement service**

`backend/src/services/cashflow.service.ts`:
```typescript
import { AppDataSource } from '../config/database'

export type Granularity = 'month' | 'week'
export type SectionCode = 'operational' | 'investing' | 'financing' | null

export interface PeriodBucket {
  start: string  // ISO
  end: string
  label: string
}

export interface CategoryRow {
  category_id: string | null
  name: string
  parent_id: string | null
  cashflow_section: SectionCode
  values: number[]      // one per period
}

export interface CashflowReport {
  periods: PeriodBucket[]
  sections: Array<{
    code: 'operational' | 'investing' | 'financing'
    inflows: CategoryRow[]
    outflows: CategoryRow[]
    inflows_total: number[]
    outflows_total: number[]
    net: number[]
  }>
  unsorted_inflows: CategoryRow[]    // categories without cashflow_section
  unsorted_outflows: CategoryRow[]
  opening_balance: number
  closing_balance: number
  net_cash_flow: number[]
}

interface Filters {
  from: string                   // ISO start
  to: string                     // ISO end inclusive
  granularity: Granularity
  account_ids?: string[]
  counterparty_id?: string
  project_id?: string
  department_id?: string
}

function buildPeriods(from: string, to: string, granularity: Granularity): PeriodBucket[] {
  const periods: PeriodBucket[] = []
  const start = new Date(from)
  const end = new Date(to)

  if (granularity === 'month') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)  // last day of month
      periods.push({
        start: cur.toISOString().slice(0, 10),
        end:   next.toISOString().slice(0, 10),
        label: cur.toLocaleString('ru-RU', { month: 'short', year: '2-digit' }),
      })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    // week: Monday-Sunday
    const dayOfWeek = (start.getDay() + 6) % 7   // Mon=0..Sun=6
    let cur = new Date(start)
    cur.setDate(cur.getDate() - dayOfWeek)
    while (cur <= end) {
      const next = new Date(cur)
      next.setDate(next.getDate() + 6)
      periods.push({
        start: cur.toISOString().slice(0, 10),
        end:   next.toISOString().slice(0, 10),
        label: `${cur.getDate()}.${(cur.getMonth()+1).toString().padStart(2,'0')}`,
      })
      cur = new Date(cur)
      cur.setDate(cur.getDate() + 7)
    }
  }
  return periods
}

export async function buildCashflowReport(f: Filters): Promise<CashflowReport> {
  const periods = buildPeriods(f.from, f.to, f.granularity)
  const trunc = f.granularity === 'month' ? 'month' : 'week'

  // Single aggregation query
  const qb = AppDataSource.createQueryBuilder()
    .select(`date_trunc('${trunc}', t.date)`, 'period')
    .addSelect('t.category_id', 'category_id')
    .addSelect('t.type', 'type')
    .addSelect('SUM(t.amount)', 'amount')
    .from('transactions', 't')
    .where('t.date >= :from', { from: f.from })
    .andWhere('t.date <= :to', { to: f.to })
    .andWhere('t.is_inter_account_transfer = false')

  if (f.account_ids && f.account_ids.length > 0) {
    qb.andWhere('t.bank_account_id IN (:...accs)', { accs: f.account_ids })
  }
  if (f.counterparty_id) qb.andWhere('t.counterparty_id = :cp', { cp: f.counterparty_id })
  if (f.project_id)      qb.andWhere('t.project_id = :proj', { proj: f.project_id })
  if (f.department_id)   qb.andWhere('t.department_id = :dep', { dep: f.department_id })

  qb.groupBy('period').addGroupBy('t.category_id').addGroupBy('t.type')

  const rows = await qb.getRawMany<{ period: Date; category_id: string | null; type: 'income' | 'expense'; amount: string }>()

  // Index categories
  const cats = await AppDataSource.query(`
    SELECT id, name, parent_id, cashflow_section, type FROM categories
  `) as Array<{ id: string; name: string; parent_id: string | null; cashflow_section: SectionCode; type: 'income'|'expense' }>
  const catById = new Map(cats.map(c => [c.id, c]))

  // Bucket index for quick period lookup by date
  const periodIndex = new Map<string, number>()
  periods.forEach((p, i) => periodIndex.set(p.start, i))

  function periodIndexFor(d: Date): number {
    if (f.granularity === 'month') {
      const key = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
      return periodIndex.get(key) ?? -1
    } else {
      const dow = (d.getDay() + 6) % 7
      const ws = new Date(d)
      ws.setDate(ws.getDate() - dow)
      const key = ws.toISOString().slice(0, 10)
      return periodIndex.get(key) ?? -1
    }
  }

  // Build per-category time series
  const seriesByKey = new Map<string, CategoryRow>()  // key = `${categoryId}:${type}`
  for (const row of rows) {
    const idx = periodIndexFor(new Date(row.period))
    if (idx < 0) continue
    const cat = row.category_id ? catById.get(row.category_id) : null
    const key = `${row.category_id || 'null'}:${row.type}`
    let series = seriesByKey.get(key)
    if (!series) {
      series = {
        category_id: row.category_id,
        name: cat?.name || '— Без категории',
        parent_id: cat?.parent_id || null,
        cashflow_section: cat?.cashflow_section || null,
        values: new Array(periods.length).fill(0),
      }
      seriesByKey.set(key, series)
    }
    series.values[idx] = (series.values[idx] || 0) + parseFloat(row.amount)
  }

  // Group by section
  const sections: CashflowReport['sections'] = (['operational', 'investing', 'financing'] as const).map(code => {
    const inflows: CategoryRow[] = []
    const outflows: CategoryRow[] = []
    for (const [key, series] of seriesByKey) {
      if (series.cashflow_section !== code) continue
      const isIncome = key.endsWith(':income')
      if (isIncome) inflows.push(series)
      else outflows.push(series)
    }
    inflows.sort((a, b) => a.name.localeCompare(b.name))
    outflows.sort((a, b) => a.name.localeCompare(b.name))

    const inflows_total = periods.map((_, i) => inflows.reduce((s, r) => s + (r.values[i] || 0), 0))
    const outflows_total = periods.map((_, i) => outflows.reduce((s, r) => s + (r.values[i] || 0), 0))
    const net = periods.map((_, i) => inflows_total[i] - outflows_total[i])
    return { code, inflows, outflows, inflows_total, outflows_total, net }
  })

  // Unsorted (no cashflow_section)
  const unsorted_inflows: CategoryRow[] = []
  const unsorted_outflows: CategoryRow[] = []
  for (const [key, series] of seriesByKey) {
    if (series.cashflow_section !== null) continue
    if (key.endsWith(':income')) unsorted_inflows.push(series)
    else unsorted_outflows.push(series)
  }

  // Net cash flow per period
  const net_cash_flow = periods.map((_, i) =>
    sections.reduce((s, sec) => s + sec.net[i], 0) +
    unsorted_inflows.reduce((s, r) => s + (r.values[i] || 0), 0) -
    unsorted_outflows.reduce((s, r) => s + (r.values[i] || 0), 0)
  )

  // Opening balance: sum of opening_balance across selected accounts +
  // all transactions before f.from (excluding transfers)
  const accountFilter = (f.account_ids && f.account_ids.length > 0)
    ? `AND id = ANY($1::uuid[])` : ``
  const accParams = (f.account_ids && f.account_ids.length > 0) ? [f.account_ids] : []
  const openingRow = await AppDataSource.query(
    `SELECT COALESCE(SUM(opening_balance), 0) as ob FROM bank_accounts WHERE is_active = true ${accountFilter}`,
    accParams,
  ) as Array<{ ob: string }>
  const ob_static = parseFloat(openingRow[0]?.ob || '0')

  const beforeQb = AppDataSource.createQueryBuilder()
    .select('t.type', 'type').addSelect('SUM(t.amount)', 'amount')
    .from('transactions', 't')
    .where('t.date < :from', { from: f.from })
    .andWhere('t.is_inter_account_transfer = false')
  if (f.account_ids && f.account_ids.length > 0) {
    beforeQb.andWhere('t.bank_account_id IN (:...accs)', { accs: f.account_ids })
  }
  beforeQb.groupBy('t.type')
  const before = await beforeQb.getRawMany<{ type: 'income'|'expense'; amount: string }>()
  const ob_dynamic = before.reduce((s, r) => r.type === 'income' ? s + parseFloat(r.amount) : s - parseFloat(r.amount), 0)

  const opening_balance = ob_static + ob_dynamic
  const closing_balance = opening_balance + net_cash_flow.reduce((a, b) => a + b, 0)

  return {
    periods,
    sections,
    unsorted_inflows,
    unsorted_outflows,
    opening_balance,
    closing_balance,
    net_cash_flow,
  }
}
```

**Step 2: Build**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```

**Step 3: Commit**

```bash
git add backend/src/services/cashflow.service.ts
git commit -m "feat(bdds): cashflow report aggregation service"
```

---

### Task 6.2: Cashflow API endpoint

**Files:**
- Create: `backend/src/controllers/cashflow.controller.ts`
- Create: `backend/src/routes/cashflow.routes.ts`
- Modify: `backend/src/server.ts`

**Step 1: Controller**

`backend/src/controllers/cashflow.controller.ts`:
```typescript
import { Request, Response } from 'express'
import { buildCashflowReport, Granularity } from '../services/cashflow.service'

export const cashflowController = {
  async report(req: Request, res: Response): Promise<void> {
    try {
      const { from, to, granularity, accounts, counterparty_id, project_id, department_id } = req.query
      if (!from || !to) { res.status(400).json({ error: 'from/to required' }); return }
      const accountIds = accounts ? String(accounts).split(',').filter(Boolean) : undefined

      const report = await buildCashflowReport({
        from: String(from),
        to: String(to),
        granularity: (String(granularity || 'month')) as Granularity,
        account_ids: accountIds,
        counterparty_id: counterparty_id ? String(counterparty_id) : undefined,
        project_id: project_id ? String(project_id) : undefined,
        department_id: department_id ? String(department_id) : undefined,
      })
      res.json(report)
    } catch (err: any) {
      console.error('[cashflow]', err)
      res.status(500).json({ error: err.message || 'Ошибка отчёта' })
    }
  },
}
```

**Step 2: Routes**

`backend/src/routes/cashflow.routes.ts`:
```typescript
import { Router } from 'express'
import { cashflowController } from '../controllers/cashflow.controller'
const router = Router()
router.get('/', cashflowController.report)
export default router
```

**Step 3: Register in server.ts**

```typescript
import cashflowRoutes from './routes/cashflow.routes'
app.use('/api/cashflow', authMiddleware, cashflowRoutes)
```

**Step 4: Smoke test**

```bash
curl -s "http://localhost:3001/api/cashflow?from=2026-01-01&to=2026-12-31&granularity=month" \
  -H "Authorization: Bearer $TOKEN" | jq '.periods | length, .opening_balance, .net_cash_flow'
```
Expected: 12 (periods), some numeric balance, array of 12 numbers.

**Step 5: Commit**

```bash
git add backend/src/controllers/cashflow.controller.ts backend/src/routes/cashflow.routes.ts backend/src/server.ts
git commit -m "feat(bdds): cashflow report API endpoint"
```

---

### Task 6.3: Frontend cashflow API + page skeleton

**Files:**
- Create: `frontend/src/api/cashflow.ts`
- Create: `frontend/src/pages/Cashflow.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx` (nav link «БДДС»)

**Step 1: API module**

`frontend/src/api/cashflow.ts`:
```typescript
import { apiClient as api } from './client'

export interface PeriodBucket { start: string; end: string; label: string }
export interface CategoryRow {
  category_id: string | null
  name: string
  parent_id: string | null
  cashflow_section: 'operational' | 'investing' | 'financing' | null
  values: number[]
}
export interface CashflowReport {
  periods: PeriodBucket[]
  sections: Array<{
    code: 'operational' | 'investing' | 'financing'
    inflows: CategoryRow[]
    outflows: CategoryRow[]
    inflows_total: number[]
    outflows_total: number[]
    net: number[]
  }>
  unsorted_inflows: CategoryRow[]
  unsorted_outflows: CategoryRow[]
  opening_balance: number
  closing_balance: number
  net_cash_flow: number[]
}

export interface CashflowFilters {
  from: string
  to: string
  granularity: 'month' | 'week'
  accounts?: string[]
  counterparty_id?: string
  project_id?: string
  department_id?: string
}

export const cashflowApi = {
  report: (f: CashflowFilters): Promise<CashflowReport> => {
    const params: any = { from: f.from, to: f.to, granularity: f.granularity }
    if (f.accounts?.length) params.accounts = f.accounts.join(',')
    if (f.counterparty_id) params.counterparty_id = f.counterparty_id
    if (f.project_id) params.project_id = f.project_id
    if (f.department_id) params.department_id = f.department_id
    return api.get('/cashflow', { params }).then(r => r.data)
  },
}
```

**Step 2: Page skeleton with filters**

`frontend/src/pages/Cashflow.tsx`:
```typescript
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader2, Filter } from 'lucide-react'
import { cashflowApi, CashflowReport } from '../api/cashflow'
import { bankAccountsApi, BankAccount } from '../api/bankAccounts'

const SECTION_LABELS: Record<string, string> = {
  operational: 'Операционная деятельность',
  investing:   'Инвестиционная деятельность',
  financing:   'Финансовая деятельность',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU')
}

export default function Cashflow() {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const yearEnd   = `${today.getFullYear()}-12-31`

  const [from, setFrom] = useState(yearStart)
  const [to, setTo]     = useState(yearEnd)
  const [granularity, setGranularity] = useState<'month' | 'week'>('month')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])  // empty = all

  const [report, setReport] = useState<CashflowReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  useEffect(() => { bankAccountsApi.list().then(setAccounts).catch(console.error) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await cashflowApi.report({
        from, to, granularity,
        accounts: selectedAccounts.length ? selectedAccounts : undefined,
      })
      setReport(r)
    } finally { setLoading(false) }
  }, [from, to, granularity, selectedAccounts])

  useEffect(() => { load() }, [load])

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-xl sm:text-2xl font-bold text-brand-text mb-4">БДДС / Отчёт о движении денежных средств</h1>

      {/* Filters bar */}
      <div className="bg-card border border-brand-border rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-brand-text-secondary" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-brand-border rounded-lg px-2 py-1 bg-card" />
          <span className="text-brand-text-secondary">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-brand-border rounded-lg px-2 py-1 bg-card" />
        </div>
        <div className="flex bg-subtle rounded-lg p-0.5">
          {(['month', 'week'] as const).map(g => (
            <button key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-sm rounded-md ${granularity === g ? 'bg-card shadow-sm' : 'text-brand-text-secondary'}`}
            >
              {g === 'month' ? 'Месяц' : 'Неделя'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {accounts.map(a => (
            <button key={a.id}
              onClick={() => toggleAccount(a.id)}
              className={`px-3 py-1 text-xs rounded-lg border ${
                selectedAccounts.length === 0 || selectedAccounts.includes(a.id)
                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                  : 'bg-card border-brand-border text-brand-text-secondary'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-primary-600" />}
      </div>

      {/* Report table */}
      {report && (
        <div className="bg-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-subtle">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-subtle z-10 min-w-[280px]">Категория</th>
                  {report.periods.map(p => (
                    <th key={p.start} className="text-right px-3 py-2 whitespace-nowrap">{p.label}</th>
                  ))}
                  <th className="text-right px-3 py-2 bg-card font-semibold">Итого</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance */}
                <tr className="border-b border-brand-border bg-amber-50/50 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50/50">Остаток на начало</td>
                  <td colSpan={report.periods.length} className="text-center text-brand-text-secondary">—</td>
                  <td className="px-3 py-2 text-right">{fmt(report.opening_balance)} ₽</td>
                </tr>

                {/* Sections */}
                {report.sections.map(sec => {
                  const isEmpty = sec.inflows.length === 0 && sec.outflows.length === 0
                  if (isEmpty) return null
                  const collapsed = collapsedSections[sec.code]
                  return (
                    <SectionRows
                      key={sec.code}
                      label={SECTION_LABELS[sec.code]}
                      section={sec}
                      collapsed={collapsed}
                      onToggle={() => setCollapsedSections(prev => ({ ...prev, [sec.code]: !prev[sec.code] }))}
                    />
                  )
                })}

                {/* Unsorted */}
                {(report.unsorted_inflows.length > 0 || report.unsorted_outflows.length > 0) && (
                  <UnsortedRows
                    inflows={report.unsorted_inflows}
                    outflows={report.unsorted_outflows}
                    periodCount={report.periods.length}
                  />
                )}

                {/* Totals */}
                <tr className="border-t-2 border-brand-border bg-primary-50 font-bold">
                  <td className="px-3 py-2 sticky left-0 bg-primary-50">ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК</td>
                  {report.net_cash_flow.map((v, i) => (
                    <td key={i} className={`px-3 py-2 text-right ${v >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {v >= 0 ? '+' : ''}{fmt(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {fmt(report.net_cash_flow.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
                <tr className="border-b border-brand-border bg-amber-50/50 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50/50">Остаток на конец</td>
                  <td colSpan={report.periods.length} className="text-center text-brand-text-secondary">—</td>
                  <td className="px-3 py-2 text-right">{fmt(report.closing_balance)} ₽</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Section component
function SectionRows({ label, section, collapsed, onToggle }: any) {
  const inflowsTotalSum = section.inflows_total.reduce((a: number, b: number) => a + b, 0)
  const outflowsTotalSum = section.outflows_total.reduce((a: number, b: number) => a + b, 0)
  const netTotalSum = section.net.reduce((a: number, b: number) => a + b, 0)
  return (
    <>
      <tr className="bg-subtle font-semibold cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 sticky left-0 bg-subtle">{collapsed ? '▶' : '▼'} {label}</td>
        <td colSpan={section.net.length + 1} className="text-right text-brand-text-secondary text-xs px-3">
          {collapsed && `Чистый: ${fmt(netTotalSum)}`}
        </td>
      </tr>
      {!collapsed && <>
        <tr><td className="px-6 py-1 text-xs text-brand-text-secondary italic" colSpan={section.net.length + 2}>Поступления</td></tr>
        {section.inflows.map((row: any) => (
          <CategoryRowDisplay key={row.category_id} row={row} />
        ))}
        <tr className="border-b border-brand-border/50 italic">
          <td className="px-6 py-1 sticky left-0 bg-card text-brand-text-secondary">Итого поступлений</td>
          {section.inflows_total.map((v: number, i: number) => (
            <td key={i} className="px-3 py-1 text-right">{fmt(v)}</td>
          ))}
          <td className="px-3 py-1 text-right font-semibold">{fmt(inflowsTotalSum)}</td>
        </tr>

        <tr><td className="px-6 py-1 text-xs text-brand-text-secondary italic" colSpan={section.net.length + 2}>Выплаты</td></tr>
        {section.outflows.map((row: any) => (
          <CategoryRowDisplay key={row.category_id} row={row} />
        ))}
        <tr className="border-b border-brand-border/50 italic">
          <td className="px-6 py-1 sticky left-0 bg-card text-brand-text-secondary">Итого выплат</td>
          {section.outflows_total.map((v: number, i: number) => (
            <td key={i} className="px-3 py-1 text-right text-red-700">−{fmt(v)}</td>
          ))}
          <td className="px-3 py-1 text-right font-semibold text-red-700">−{fmt(outflowsTotalSum)}</td>
        </tr>

        <tr className="border-b border-brand-border bg-blue-50/50 font-semibold">
          <td className="px-6 py-2 sticky left-0 bg-blue-50/50">Чистый поток</td>
          {section.net.map((v: number, i: number) => (
            <td key={i} className={`px-3 py-2 text-right ${v >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {v >= 0 ? '+' : ''}{fmt(v)}
            </td>
          ))}
          <td className="px-3 py-2 text-right">{fmt(netTotalSum)}</td>
        </tr>
      </>}
    </>
  )
}

function CategoryRowDisplay({ row }: { row: any }) {
  const total = row.values.reduce((a: number, b: number) => a + b, 0)
  return (
    <tr className="border-b border-brand-border/30 hover:bg-subtle">
      <td className="px-6 py-1 sticky left-0 bg-card">{row.name}</td>
      {row.values.map((v: number, i: number) => (
        <td key={i} className="px-3 py-1 text-right">{v ? fmt(v) : ''}</td>
      ))}
      <td className="px-3 py-1 text-right">{fmt(total)}</td>
    </tr>
  )
}

function UnsortedRows({ inflows, outflows, periodCount }: any) {
  if (inflows.length === 0 && outflows.length === 0) return null
  return (
    <>
      <tr className="bg-subtle italic text-brand-text-secondary">
        <td className="px-3 py-2 sticky left-0 bg-subtle" colSpan={periodCount + 2}>
          Без раздела (категории без cashflow_section) — <a href="/categories" className="underline text-primary-600">проставить разделы</a>
        </td>
      </tr>
      {[...inflows, ...outflows].map((row: any) => (
        <CategoryRowDisplay key={(row.category_id || 'null') + ':' + (inflows.includes(row) ? 'in' : 'out')} row={row} />
      ))}
    </>
  )
}
```

**Step 3: Add route in App.tsx + nav link**

```typescript
const Cashflow = lazy(() => import('./pages/Cashflow'))
<Route path="/financial-reports/cashflow" element={<Cashflow />} />
```

In `Layout.tsx` add nav link to `/financial-reports/cashflow` labelled «БДДС».

**Step 4: Build + smoke test**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10 && npm run build 2>&1 | tail -3
```

In browser: navigate to `/financial-reports/cashflow`, verify:
- Filters render
- Table loads with periods columns
- Sections grouped (collapsible)
- Numbers formatted with ru-RU spacing

**Step 5: Commit**

```bash
git add frontend/src/api/cashflow.ts frontend/src/pages/Cashflow.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(bdds): cashflow report page with filters, sections, month/week toggle"
```

---

### Task 6.4: Cell click → drill-down panel

**Files:**
- Modify: `frontend/src/pages/Cashflow.tsx` (add side panel that fetches transactions for clicked cell)

**Step 1: Add drilldown state + side panel**

Above `return` in `Cashflow.tsx`:
```typescript
const [drilldown, setDrilldown] = useState<{
  category_id: string | null
  category_name: string
  period_start: string
  period_end: string
  type: 'income' | 'expense'
} | null>(null)
const [drilldownTx, setDrilldownTx] = useState<any[]>([])
const [drilldownLoading, setDrilldownLoading] = useState(false)

useEffect(() => {
  if (!drilldown) { setDrilldownTx([]); return }
  setDrilldownLoading(true)
  // Reuse existing /api/transactions endpoint with filters
  const params = new URLSearchParams({
    date_from: drilldown.period_start,
    date_to: drilldown.period_end,
    type: drilldown.type,
  })
  if (drilldown.category_id) params.set('category_id', drilldown.category_id)
  fetch(`/api/transactions?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } })
    .then(r => r.json())
    .then(data => setDrilldownTx(Array.isArray(data) ? data : data.items || []))
    .finally(() => setDrilldownLoading(false))
}, [drilldown])
```

(Adjust `/api/transactions` query params to match what the existing endpoint expects — read `backend/src/controllers/transaction.controller.ts` first.)

**Step 2: Wire up cell clicks**

Update `<CategoryRowDisplay>` to accept `onCellClick` prop and pass it through:
```tsx
function CategoryRowDisplay({ row, periods, onCellClick, type }: any) {
  return (
    <tr className="border-b border-brand-border/30 hover:bg-subtle">
      <td className="px-6 py-1 sticky left-0 bg-card">{row.name}</td>
      {row.values.map((v: number, i: number) => (
        <td key={i}
          onClick={() => v && onCellClick({
            category_id: row.category_id,
            category_name: row.name,
            period_start: periods[i].start,
            period_end: periods[i].end,
            type,
          })}
          className={`px-3 py-1 text-right cursor-pointer ${v ? 'hover:bg-primary-50' : ''}`}
        >
          {v ? fmt(v) : ''}
        </td>
      ))}
      <td className="px-3 py-1 text-right">{fmt(row.values.reduce((a:number, b:number) => a+b, 0))}</td>
    </tr>
  )
}
```

Pass `periods` and `onCellClick={setDrilldown}` and `type` from each context (inflows = 'income', outflows = 'expense'). Update SectionRows accordingly.

**Step 3: Side panel JSX**

After the main table, add:
```tsx
{drilldown && (
  <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-card border-l border-brand-border shadow-2xl z-40 overflow-y-auto">
    <div className="p-4 border-b border-brand-border flex items-center justify-between sticky top-0 bg-card">
      <div>
        <h3 className="font-semibold">{drilldown.category_name}</h3>
        <p className="text-xs text-brand-text-secondary">{drilldown.period_start} → {drilldown.period_end}</p>
      </div>
      <button onClick={() => setDrilldown(null)} className="text-brand-text-secondary hover:text-brand-text text-xl">×</button>
    </div>
    <div className="p-4">
      {drilldownLoading && <Loader2 size={16} className="animate-spin" />}
      {!drilldownLoading && drilldownTx.length === 0 && <p className="text-sm text-brand-text-secondary">Нет транзакций</p>}
      {drilldownTx.map((tx: any) => (
        <div key={tx.id} className="border-b border-brand-border/40 py-2 text-sm">
          <div className="flex justify-between">
            <span>{tx.date}</span>
            <span className={tx.type === 'income' ? 'text-green-700' : 'text-red-700'}>
              {tx.type === 'income' ? '+' : '−'}{fmt(Number(tx.amount))} ₽
            </span>
          </div>
          <p className="text-xs text-brand-text-secondary truncate">{tx.counterparty?.name || tx.counterparty_name}</p>
          {tx.raw_description && <p className="text-xs text-brand-text-secondary italic truncate">{tx.raw_description}</p>}
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 4: Build + smoke test**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -5
```

In browser: click a non-zero cell → side panel opens with transactions for that period+category.

**Step 5: Commit**

```bash
git add frontend/src/pages/Cashflow.tsx
git commit -m "feat(bdds): cell click drilldown showing underlying transactions"
```

---

## Stage 7 — Polish + Deploy

### Task 7.1: Inter-account transfer manual mark in Transactions

**Files:**
- Modify: `frontend/src/pages/Transactions.tsx` (add «🔄 Это перевод» button)
- Modify: `backend/src/controllers/transaction.controller.ts` (add endpoint for transfer linking)

**Step 1: Backend endpoint to link transactions as transfer**

In `transaction.controller.ts`, add method:
```typescript
async markAsTransfer(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { mirror_id } = req.body
  if (!mirror_id) { res.status(400).json({ error: 'mirror_id required' }); return }

  const repo = AppDataSource.getRepository(Transaction)
  await repo.update(id,        { is_inter_account_transfer: true, linked_transfer_id: mirror_id } as any)
  await repo.update(mirror_id, { is_inter_account_transfer: true, linked_transfer_id: id } as any)
  res.json({ success: true })
}
```

Register route in `transaction.routes.ts`:
```typescript
router.post('/:id/mark-transfer', transactionController.markAsTransfer)
```

**Step 2: Add unmark endpoint**

```typescript
async unmarkTransfer(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const repo = AppDataSource.getRepository(Transaction)
  const tx = await repo.findOne({ where: { id } })
  if (!tx) { res.status(404).json({ error: 'Не найдено' }); return }
  const linkedId = (tx as any).linked_transfer_id
  await repo.update(id, { is_inter_account_transfer: false, linked_transfer_id: null } as any)
  if (linkedId) await repo.update(linkedId, { is_inter_account_transfer: false, linked_transfer_id: null } as any)
  res.json({ success: true })
}

// route
router.post('/:id/unmark-transfer', transactionController.unmarkTransfer)
```

**Step 3: Frontend button + modal**

In `Transactions.tsx`, in each row's actions, add:
```tsx
<button onClick={() => openTransferDialog(tx)} title="Это перевод между счетами">🔄</button>
```

Modal: list candidate mirror transactions (same amount, opposite type, date ±2 days, different bank_account) → user picks one → API call. After link, both rows show 🔄 badge.

(Implementation details left for executor — keep modal simple: list of candidates with radio buttons + Confirm.)

**Step 4: Build + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -5
cd ../frontend && npx tsc --noEmit 2>&1 | head -5
git add backend/src/controllers/transaction.controller.ts backend/src/routes/transaction.routes.ts frontend/src/pages/Transactions.tsx
git commit -m "feat(bdds): manual transfer marking in Transactions list"
```

---

### Task 7.2: Categories — bulk-assign cashflow_section

**Files:**
- Modify: `frontend/src/pages/Categories.tsx`

**Step 1: Add inline cashflow_section selector per row**

Already covered in Task 5.2. In addition, after the table, add a bulk-assign helper:
```tsx
{unsorted_count > 0 && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
    <p className="text-sm">⚠️ {unsorted_count} категорий без раздела БДДС.</p>
    <p className="text-xs text-brand-text-secondary mt-1">
      Это значит, что транзакции в этих категориях попадут в блок «Без раздела» в БДДС-отчёте.
      Проставьте раздел через выпадающий список в каждой строке.
    </p>
  </div>
)}
```

(Compute `unsorted_count = items.filter(c => !c.cashflow_section).length`.)

**Step 2: Commit**

```bash
git add frontend/src/pages/Categories.tsx
git commit -m "feat(bdds): notify about categories without cashflow_section"
```

---

### Task 7.3: Excel export of cashflow report

**Files:**
- Modify: `frontend/src/pages/Cashflow.tsx`

**Step 1: Install SheetJS in frontend (if not already)**

```bash
cd frontend && npm install xlsx
```

**Step 2: Add export button**

In the filters bar of Cashflow.tsx:
```tsx
<button onClick={exportXlsx} className="ml-auto px-3 py-1 text-sm border border-brand-border rounded-lg hover:bg-subtle">
  ↓ Excel
</button>
```

Implementation:
```typescript
import * as XLSX from 'xlsx'

const exportXlsx = () => {
  if (!report) return
  const aoa: any[][] = []
  aoa.push(['Категория', ...report.periods.map(p => p.label), 'Итого'])
  aoa.push(['Остаток на начало', ...new Array(report.periods.length).fill(''), report.opening_balance])

  for (const sec of report.sections) {
    if (sec.inflows.length === 0 && sec.outflows.length === 0) continue
    aoa.push([SECTION_LABELS[sec.code], ...new Array(report.periods.length).fill(''), ''])
    aoa.push(['  Поступления'])
    sec.inflows.forEach(r => aoa.push(['    ' + r.name, ...r.values, r.values.reduce((a,b) => a+b, 0)]))
    aoa.push(['  Итого поступлений', ...sec.inflows_total, sec.inflows_total.reduce((a,b)=>a+b,0)])
    aoa.push(['  Выплаты'])
    sec.outflows.forEach(r => aoa.push(['    ' + r.name, ...r.values.map(v => -v), -r.values.reduce((a,b) => a+b, 0)]))
    aoa.push(['  Итого выплат', ...sec.outflows_total.map(v => -v), -sec.outflows_total.reduce((a,b)=>a+b,0)])
    aoa.push(['  Чистый поток', ...sec.net, sec.net.reduce((a,b) => a+b, 0)])
  }

  aoa.push(['ЧИСТЫЙ ДЕНЕЖНЫЙ ПОТОК', ...report.net_cash_flow, report.net_cash_flow.reduce((a,b) => a+b, 0)])
  aoa.push(['Остаток на конец', ...new Array(report.periods.length).fill(''), report.closing_balance])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'БДДС')
  XLSX.writeFile(wb, `cashflow_${from}_${to}.xlsx`)
}
```

**Step 3: Build + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -5
git add frontend/src/pages/Cashflow.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(bdds): Excel export of cashflow report"
```

---

### Task 7.4: Smoke test end-to-end + merge to main

**Step 1: Final build of both backend & frontend**

```bash
cd backend && npx tsc --noEmit 2>&1 | tail -3
cd ../frontend && npm run build 2>&1 | tail -5
```
Both should succeed without errors.

**Step 2: Manual end-to-end test**

1. Start backend + frontend dev servers
2. Navigate `/financial-reports/import` → upload real Tochka file → verify preview → commit
3. Navigate `/financial-reports/import` → upload real Ozon file → verify preview shows 🔄 transfers if any matched → commit
4. Navigate `/categories` → assign `cashflow_section` to a few categories
5. Navigate `/financial-reports/cashflow` → verify report renders, sections populated, click cell → drill-down panel works
6. Click "↓ Excel" → file downloads, opens correctly
7. Navigate `/transactions` → click 🔄 on a row → mark as transfer → reload → row shows 🔄 badge

**Step 3: Merge to main + push**

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
git checkout main
git merge claude/clever-euclid --no-edit
git push origin main
git push vercel-deploy main
```

**Step 4: Apply migration on production**

If using Railway for backend — TypeORM `synchronize: false` means the migration must be applied manually to production Supabase. Use Supabase MCP `apply_migration` against the production project (same one as dev — already done in Task 1.1).

If a separate prod Supabase exists: run the same SQL there.

**Step 5: Done**

Phase 1 (MVP) shipped. Roadmap items (Phase 2 — план vs факт, recurring payments; Phase 3 — payment calendar) are tracked in the design doc.

---

## Notes for the Executor

- **TypeORM quirks:** numeric columns may come back as strings from Postgres. Apply `parseFloat` where needed (especially for `amount` in cashflow aggregation — already handled).
- **Auth:** all new routes use `authMiddleware` — confirm `req.user.userId` is populated.
- **Russian text in UI:** copy exactly as written — no translation.
- **Russian dates:** all dates stored as ISO `YYYY-MM-DD`; displayed via `toLocaleDateString('ru-RU')` where user-facing.
- **TypeScript strictness:** use type assertions `as any` only where TypeORM repo types are awkward (mainly in `update()` calls with partial fields). Don't introduce `any` elsewhere.
- **Frequent commits:** every task ends with a commit — keep them small and descriptive.

---

## Roadmap (Out of MVP — for next iteration)

**Phase 2** — Plan vs Fact + Recurring Payments (~7 days):
- New table `cashflow_plan` (period, category_id, planned_amount)
- Plan editing UI in cashflow page (toggle «План/Факт/Сравнение»)
- New module `RecurringPayments` (templates: rent, salaries, subscriptions)
  - Auto-generation of planned cashflow entries from templates
  - Aggregated «monthly financial burden» view
  - Each instance editable independently (rent normally 80k, December 100k)

**Phase 3** — Payment Calendar (~3 days):
- Calendar grid view of expected payments per day
- Visualizes recurring payments + manually entered planned ones
- Drag-and-drop to reschedule
