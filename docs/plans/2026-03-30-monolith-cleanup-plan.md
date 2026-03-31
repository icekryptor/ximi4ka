# Monolith Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead code, deduplicate utilities, wire up orphaned entities/routes, add frontend helpers — max impact, min risk.

**Architecture:** Light cleanup of existing monolith. No business logic changes, no API contract changes, no DB schema changes.

**Tech Stack:** Node.js + Express + TypeORM (backend), React 18 + TypeScript + Vite (frontend)

---

## Task 1: Extract shared `round()` utility

Three controllers define identical `round()` functions. Extract to a shared utility.

**Files:**
- Create: `backend/src/utils/math.ts`
- Modify: `backend/src/controllers/sales-report.controller.ts:12-14`
- Modify: `backend/src/controllers/wb-ads.controller.ts:408-410`
- Modify: `backend/src/controllers/wb-finance.controller.ts:378-380`

**Step 1: Create `backend/src/utils/math.ts`**

```typescript
export function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
```

**Step 2: Update `sales-report.controller.ts`**

Replace lines 12-14 (the local `round` function) with:
```typescript
import { round } from '../utils/math';
```
Add this import after line 8 (the last existing import). Delete the local function definition at lines 12-14.

**Step 3: Update `wb-ads.controller.ts`**

Add `import { round } from '../utils/math';` after line 5. Delete the local `round` function at line 408-410.

**Step 4: Update `wb-finance.controller.ts`**

Add `import { round } from '../utils/math';` after line 4. Delete the local `round` function at line 378-380.

**Step 5: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add backend/src/utils/math.ts backend/src/controllers/sales-report.controller.ts backend/src/controllers/wb-ads.controller.ts backend/src/controllers/wb-finance.controller.ts
git commit -m "refactor: extract shared round() utility to utils/math.ts"
```

---

## Task 2: Delete duplicate unit economics files

The old `unitEconomics.controller.ts`, `economics.routes.ts`, `UnitEconomics.ts` entity, and `MarginCalculation.ts` entity are dead code — superseded by `unit-economics.controller.ts` + `UnitEconomicsCalculation.ts`. The old routes are NOT mounted in `server.ts`.

**Files:**
- Delete: `backend/src/controllers/unitEconomics.controller.ts` (172 lines)
- Delete: `backend/src/routes/economics.routes.ts` (15 lines)
- Delete: `backend/src/entities/UnitEconomics.ts` (77 lines)
- Delete: `backend/src/entities/MarginCalculation.ts` (72 lines)

**Step 1: Verify no other files import these**

Search for imports of each file. Expected results:
- `unitEconomics.controller` → only imported by `economics.routes.ts` (being deleted)
- `economics.routes` → NOT imported in `server.ts` (already dead)
- `UnitEconomics` entity → only imported by `unitEconomics.controller.ts` (being deleted) and NOT in `database.ts`
- `MarginCalculation` entity → NOT imported anywhere active

**Step 2: Delete files**

```bash
rm backend/src/controllers/unitEconomics.controller.ts
rm backend/src/routes/economics.routes.ts
rm backend/src/entities/UnitEconomics.ts
rm backend/src/entities/MarginCalculation.ts
```

**Step 3: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors (these files were not referenced by any active code).

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: delete dead unit economics files (old API, orphaned entities)"
```

---

## Task 3: Register orphaned entities in `database.ts`

Three entities exist but are NOT registered in the DataSource — TypeORM doesn't know about them: `Employee`, `SalesChannel`, `QcChecklist`.

**Files:**
- Modify: `backend/src/config/database.ts:1-31`

**Step 1: Add imports**

After line 21 (`import { DailySales }...`), add:
```typescript
import { Employee } from '../entities/Employee';
import { SalesChannel } from '../entities/SalesChannel';
import { QcChecklist } from '../entities/QcChecklist';
```

**Step 2: Add to allEntities array**

On line 31, the `allEntities` array ends with `...User, DailySales]`. Append the three new entities:

```typescript
const allEntities = [Transaction, Counterparty, Category, Component, ComponentPart, Kit, KitComponent, Supply, SupplyItem, MarketplaceSale, SkuMapping, WbAdStat, WbAdNote, WbFinancialStat, UnitEconomicsCalculation, User, DailySales, Employee, SalesChannel, QcChecklist];
```

**Step 3: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add backend/src/config/database.ts
git commit -m "fix: register Employee, SalesChannel, QcChecklist entities in DataSource"
```

---

## Task 4: Wire up dead routes in `server.ts`

Five route files exist with controllers but are never mounted in Express. All need `authMiddleware`.

**Files:**
- Modify: `backend/src/server.ts:11-28,67-80`

**Step 1: Add route imports**

After line 24 (`import salesReportRoutes...`), add:
```typescript
import employeeRoutes from './routes/employee.routes';
import productionOrderRoutes from './routes/productionOrder.routes';
import qcRoutes from './routes/qc.routes';
import salesChannelRoutes from './routes/salesChannel.routes';
import supplyDocumentRoutes from './routes/supplyDocument.routes';
```

**Step 2: Mount routes**

After line 80 (`app.use('/api/sales-report'...)`), add:
```typescript
app.use('/api/employees', authMiddleware, employeeRoutes);
app.use('/api/production-orders', authMiddleware, productionOrderRoutes);
app.use('/api/qc', authMiddleware, qcRoutes);
app.use('/api/sales-channels', authMiddleware, salesChannelRoutes);
app.use('/api/supply-documents', authMiddleware, supplyDocumentRoutes);
```

**Step 3: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: wire up employee, production-order, qc, sales-channel, supply-document routes"
```

---

## Task 5: Create CRUD API factory (frontend)

`counterparties.ts`, `categories.ts`, and `channels.ts` all follow the same CRUD pattern. Extract to a factory. **Exclude `employees.ts`** — it uses `FormData` for create/update, not `Partial<T>`.

**Files:**
- Create: `frontend/src/api/crudFactory.ts`
- Modify: `frontend/src/api/counterparties.ts`
- Modify: `frontend/src/api/categories.ts`
- Modify: `frontend/src/api/channels.ts`

**Step 1: Create `frontend/src/api/crudFactory.ts`**

```typescript
import { apiClient } from './client';

export interface CrudApi<T> {
  getAll: (params?: Record<string, unknown>) => Promise<T[]>;
  getById: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

export function createCrudApi<T>(endpoint: string): CrudApi<T> {
  return {
    getAll: async (params) => {
      const response = await apiClient.get<T[]>(endpoint, { params });
      return response.data;
    },
    getById: async (id) => {
      const response = await apiClient.get<T>(`${endpoint}/${id}`);
      return response.data;
    },
    create: async (data) => {
      const response = await apiClient.post<T>(endpoint, data);
      return response.data;
    },
    update: async (id, data) => {
      const response = await apiClient.put<T>(`${endpoint}/${id}`, data);
      return response.data;
    },
    delete: async (id) => {
      await apiClient.delete(`${endpoint}/${id}`);
    },
  };
}
```

**Step 2: Refactor `frontend/src/api/counterparties.ts`**

Replace entire file with:
```typescript
import { createCrudApi } from './crudFactory';
import { Counterparty } from './types';

export const counterpartiesApi = createCrudApi<Counterparty>('/counterparties');
```

**Step 3: Refactor `frontend/src/api/categories.ts`**

Replace entire file with:
```typescript
import { createCrudApi } from './crudFactory';
import { Category } from './types';

export const categoriesApi = createCrudApi<Category>('/categories');
```

**Step 4: Refactor `frontend/src/api/channels.ts`**

Keep the type exports (MarketplaceType enum, MARKETPLACE_LABELS, SalesChannel interface). Replace only the API object at lines 34-59:

```typescript
import { createCrudApi } from './crudFactory';
import { apiClient } from './client';

export enum MarketplaceType {
  WILDBERRIES = 'wildberries',
  OZON = 'ozon',
  DETMIR = 'detmir',
  WEBSITE = 'website',
  OTHER = 'other',
}

export const MARKETPLACE_LABELS: Record<MarketplaceType, string> = {
  [MarketplaceType.WILDBERRIES]: 'Wildberries',
  [MarketplaceType.OZON]: 'Ozon',
  [MarketplaceType.DETMIR]: 'Детский мир',
  [MarketplaceType.WEBSITE]: 'Сайт',
  [MarketplaceType.OTHER]: 'Другое',
};

export interface SalesChannel {
  id: string;
  name: string;
  marketplace_type: MarketplaceType;
  commission_pct: number;
  logistics_cost: number;
  storage_cost: number;
  ad_spend_pct: number;
  return_rate_pct: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const channelsApi = createCrudApi<SalesChannel>('/channels');
```

**Step 5: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. All consumers of `counterpartiesApi`, `categoriesApi`, `channelsApi` continue to work because the API surface is identical.

**Step 6: Commit**

```bash
git add frontend/src/api/crudFactory.ts frontend/src/api/counterparties.ts frontend/src/api/categories.ts frontend/src/api/channels.ts
git commit -m "refactor: extract createCrudApi factory, deduplicate 3 API modules"
```

---

## Task 6: Create `useFormModal` hook (frontend)

All modal components repeat the same pattern: `useState` for form fields, `saving` boolean, `error` string, handlers for field updates. Extract to a reusable hook.

**Files:**
- Create: `frontend/src/hooks/useFormModal.ts`

**Step 1: Create the hook**

```typescript
import { useState, useCallback } from 'react';

interface UseFormModalOptions<T> {
  initialValues: T;
}

interface UseFormModalReturn<T> {
  form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  reset: () => void;
}

export function useFormModal<T>({ initialValues }: UseFormModalOptions<T>): UseFormModalReturn<T> {
  const [form, setForm] = useState<T>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm(initialValues);
    setSaving(false);
    setError('');
  }, [initialValues]);

  return { form, setForm, updateField, saving, setSaving, error, setError, reset };
}
```

**Note:** This hook is created for future adoption. Refactoring all 11 existing modals to use it would touch too many files for this cleanup pass. New modals should use `useFormModal` from the start. Existing modals can be migrated incrementally.

**Step 2: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useFormModal.ts
git commit -m "feat: add useFormModal hook for shared form state in modals"
```

---

## Task 7: Delete dead frontend code

Two dead files: `SupplyDocuments.tsx` (unused component, not imported anywhere) and `economics.ts` (duplicate API module). Before deleting `economics.ts`, migrate its types to `unitEconomics.ts` since `MarginMatrix.tsx` imports from it.

**Files:**
- Delete: `frontend/src/components/SupplyDocuments.tsx` (176 lines)
- Modify: `frontend/src/api/unitEconomics.ts` — add `MarginMatrixRow`, `MarginMatrixResponse` types + `marginMatrix` method
- Modify: `frontend/src/pages/MarginMatrix.tsx:3` — change import from `economics` to `unitEconomics`
- Delete: `frontend/src/api/economics.ts` (86 lines)

**Step 1: Verify SupplyDocuments.tsx is truly unused**

Search for `SupplyDocuments` in all frontend files. Expected: only the file itself and possibly old imports that were commented out.

**Step 2: Delete SupplyDocuments.tsx**

```bash
rm frontend/src/components/SupplyDocuments.tsx
```

**Step 3: Add types and method to `unitEconomics.ts`**

Open `frontend/src/api/unitEconomics.ts` and add these exports (from `economics.ts` lines 38-59):

```typescript
export interface MarginMatrixRow {
  kit_id: string;
  kit_name: string;
  sku: string;
  cost_price: number;
  channels: Array<{
    channel_id: string;
    channel_name: string;
    selling_price: number;
    commission_amount: number;
    logistics_cost: number;
    storage_cost: number;
    ad_spend_amount: number;
    unit_margin: number;
    margin_pct: number;
  }>;
}

export interface MarginMatrixResponse {
  channels: Array<{ id: string; name: string }>;
  rows: MarginMatrixRow[];
}
```

Also add the `marginMatrix` method to whichever API object is exported from `unitEconomics.ts`. Check the existing API surface first — if there's already an `economicsApi`-equivalent object, add the method there. If not, add a standalone export:

```typescript
export const economicsApi = {
  marginMatrix: async (params?: { selling_prices?: Record<string, number> }) => {
    const response = await apiClient.post<MarginMatrixResponse>('/economics/margin/matrix', params || {});
    return response.data;
  },
};
```

**Step 4: Update MarginMatrix.tsx import**

Change line 3 of `frontend/src/pages/MarginMatrix.tsx` from:
```typescript
import { economicsApi, MarginMatrixResponse } from '../api/economics'
```
to:
```typescript
import { economicsApi, MarginMatrixResponse } from '../api/unitEconomics'
```

**Step 5: Delete economics.ts**

```bash
rm frontend/src/api/economics.ts
```

**Step 6: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. `MarginMatrix.tsx` now imports from `unitEconomics.ts`.

**Step 7: Commit**

```bash
git add -u frontend/src/api/unitEconomics.ts frontend/src/pages/MarginMatrix.tsx
git commit -m "chore: delete dead SupplyDocuments.tsx and economics.ts, migrate types"
```

---

## Final Verification

After all 7 tasks:

```bash
cd backend && npx tsc --noEmit && echo "✅ Backend OK"
cd frontend && npx tsc --noEmit && echo "✅ Frontend OK"
cd frontend && npm run build && echo "✅ Vite build OK"
```

**Summary:**
- Deleted: 6 files (~422 lines)
- Created: 3 files (~50 lines)
- Edited: ~8 files (import swaps, dedup)
- No business logic changes
- No API contract changes
- No database schema changes
