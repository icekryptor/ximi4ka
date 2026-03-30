# Monolith Cleanup — Design Doc

**Date:** 2026-03-30
**Approach:** A — Light cleanup (max impact, min risk)
**Goal:** Remove dead code, deduplicate utilities, wire up orphaned entities/routes, add frontend helpers.

## Backend Changes

### 1. Extract shared utilities
- Create `src/utils/math.ts` with `round(value, decimals)`.
- Replace inline `round()` in `sales-report.controller.ts`, `wb-ads.controller.ts`, `wb-finance.controller.ts`.

### 2. Remove duplicate unit economics
- Delete `unitEconomics.controller.ts` (172 lines, old API).
- Delete `economics.routes.ts` (15 lines, dead route to old controller).
- Delete `UnitEconomics.ts` entity (77 lines, orphaned duplicate of `UnitEconomicsCalculation`).
- Delete `MarginCalculation.ts` entity (72 lines, only used by deleted economics route).
- Keep `unit-economics.controller.ts` (268 lines, active) and `UnitEconomicsCalculation.ts` entity.

### 3. Register orphaned entities in database.ts
- Add `Employee`, `SalesChannel`, `QcChecklist` to DataSource entities array.

### 4. Wire up dead routes in server.ts
All with `authMiddleware`:
- `employee.routes.ts` → `/api/employees`
- `productionOrder.routes.ts` → `/api/production-orders`
- `qc.routes.ts` → `/api/qc`
- `salesChannel.routes.ts` → `/api/sales-channels`
- `supplyDocument.routes.ts` → `/api/supply-documents`

## Frontend Changes

### 5. Create CRUD API factory
New file `src/api/crudFactory.ts` — generic `createCrudApi<T>(endpoint)` returning `getAll`, `getById`, `create`, `update`, `delete`.

Refactor to use factory: `counterparties.ts`, `categories.ts`, `employees.ts`, `channels.ts`.

### 6. Create useFormModal hook
New file `src/hooks/useFormModal.ts` — extracts `form`, `setForm`, `update`, `saving`, `error`, `reset` from all 11 modal components.

### 7. Remove dead frontend code
- Delete `SupplyDocuments.tsx` (176 lines, unused component).
- Delete `economics.ts` API module (86 lines, duplicate of `unitEconomics.ts`).
- Remove any imports of `economics.ts` from pages.

## What does NOT change
- No business logic modifications.
- No API contract changes.
- No database schema changes.
- All existing tests (if any) continue to pass.

## Totals
- **Deleted:** 6 files (~423 lines)
- **Created:** 3 files (~50 lines)
- **Edited:** ~20 files (import swaps, dedup)
