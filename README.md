# XimFinance

Financial management system for **Ximi4ka** — a company manufacturing chemistry experiment kits.
Russian-language UI throughout.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeORM |
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Database | PostgreSQL (Supabase pooler) |
| State | Local React state + Axios (no Redux/Zustand) |
| Charts | Recharts |
| Icons | Lucide React |

## Quick Start

```bash
# 1. Install
cd backend && npm install
cd ../frontend && npm install

# 2. Configure
cp backend/.env.example backend/.env    # set DATABASE_URL
cp frontend/.env.example frontend/.env  # defaults to localhost:3001

# 3. Seed
cd backend && npm run seed        # categories & counterparties
cd backend && npm run seed:cost   # components & kits

# 4. Run (two terminals)
cd backend && npm run dev     # http://localhost:3001
cd frontend && npm run dev    # http://localhost:5173
```

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d
WB_API_TOKEN=<wildberries-api-token>
NODE_ENV=development
```

Or individual DB vars for local PostgreSQL:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ximfinance
DATABASE_USER=ximfinance_user
DATABASE_PASSWORD=ximfinance_pass
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3001/api
```

## Commands

| Command | Description |
|---------|-------------|
| `cd backend && npm run dev` | Start backend (port 3001, nodemon) |
| `cd frontend && npm run dev` | Start frontend (port 5173, Vite HMR) |
| `cd backend && npm run seed` | Seed categories & counterparties |
| `cd backend && npm run seed:cost` | Seed components & kits |
| `cd backend && npm run build` | Compile TypeScript → `dist/` |
| `cd frontend && npm run build` | Production build → `dist/` |
| `cd frontend && npm run lint` | ESLint |

## Project Structure

```
backend/
  src/
    config/database.ts          — TypeORM DataSource (Supabase-aware, pooler SSL)
    entities/                   — 23 TypeORM entities (UUID PKs, decorators)
    controllers/                — 18 Express controllers
    routes/                     — 18 route files, mounted at /api/*
    services/wb-api.service.ts  — Wildberries API integration
    seeds/                      — initial-data.ts, cost-calculation-data.ts
    utils/                      — supabaseStorage.ts, syncCosts.ts
    server.ts                   — Express entry + Vercel serverless export

frontend/
  src/
    api/                        — 20 Axios API modules + client.ts + types.ts
    components/                 — 17 reusable UI components
    pages/                      — 18 page components (lazy-loaded)
    utils/format.ts             — Number/date formatting helpers
    App.tsx                     — React Router with code splitting
    main.tsx                    — Entry point
    index.css                   — Tailwind imports + custom utilities
```

## API Routes

All routes prefixed `/api`. Health check: `GET /health`.

| Route | Resource |
|-------|----------|
| `/api/transactions` | Income/expense transactions |
| `/api/counterparties` | Suppliers and clients |
| `/api/categories` | Transaction categories (hierarchical) |
| `/api/reports` | Summary, by-category, by-counterparty reports |
| `/api/financial-reports` | Financial analysis |
| `/api/components` | Reagents, materials, printed goods |
| `/api/kits` | Chemistry experiment kits |
| `/api/supplies` | Procurement records with items |
| `/api/supply-documents` | Supply document attachments |
| `/api/marketplace` | Marketplace sales + SKU mappings |
| `/api/wb-ads` | Wildberries ad campaign stats |
| `/api/wb-finance` | Wildberries financial data |
| `/api/unit-economics` | Per-channel unit economics (save/load) |
| `/api/employees` | Employee records |
| `/api/production-orders` | Production orders |
| `/api/qc` | Quality control checklists & inspections |
| `/api/sales-channels` | Sales channel definitions |
| `/api/economics` | Margin calculations |

Standard CRUD on all resources: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

## Frontend Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Dashboard | Overview with key metrics |
| `/cost-calculation` | CostCalculation | Kit cost breakdown (reagents, equipment, print, labor) |
| `/components` | ComponentsCatalog | Component inventory with parts editor |
| `/supplies` | Supplies | Supply management with items |
| `/transactions` | Transactions | Income/expense log |
| `/counterparties` | Counterparties | Suppliers and clients |
| `/categories` | Categories | Transaction categories |
| `/reports` | Reports | General reports |
| `/financial-reports` | FinancialReports | Financial analysis |
| `/marketplace` | Marketplace | Marketplace integration |
| `/wb-ads` | WbAdsAnalytics | Wildberries ad campaign analytics |
| `/wb-finance` | WbFinanceReports | Wildberries financial reports |
| `/unit-economics` | UnitEconomics | Per-unit profit/margin calculator |

## Database Entities

### Core Business

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `Kit` | name, sku, seller_sku, batch_size, reagents_cost, equipment_cost, print_cost, labor_cost, total_cost, estimated_cost | Chemistry kit. `seller_sku` — universal article across all marketplaces (e.g. "7V25") |
| `Component` | name, sku, unit_price, unit, category | Reagent or material |
| `ComponentPart` | component_id, child_component_id, quantity | Subcomponents within a component |
| `KitComponent` | kit_id, component_id, quantity, cost | Many-to-many: kit to component |

### Finance

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `Transaction` | amount, type (income/expense), category_id, counterparty_id, date | Financial transactions |
| `Category` | name, type, parent_id | Hierarchical categories |
| `Counterparty` | name, type (supplier/client/both), contact info | Business partners |

### Supply Chain

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `Supply` | counterparty_id, date, total_amount, status | Procurement record |
| `SupplyItem` | supply_id, component_id, quantity, unit_price | Items within a supply |
| `SupplyDocument` | supply_id, file_path, type | Attached documents |

### Unit Economics

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `UnitEconomicsCalculation` | kit_id, channel_name, seller_price, start_price, seller_discount, cost_type, tax_rate, variable_blocks (JSONB), profit, margin | Per-channel unit economics |

**WB-specific pricing:** `seller_price = start_price * (1 - seller_discount / 100)`. Other channels enter `seller_price` directly.

**Variable blocks** (JSONB array): each block has `type`, `label`, `value_type` (fixed/percent), `value`. Types: commission, logistics, storage, advertising, acquiring, credit_commission.

**Calculation:** `profit = seller_price - (cost_price + tax + sum_of_variable_blocks)`, `margin = profit / seller_price * 100`.

### Wildberries Integration

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `WbAdStat` | campaign_id, date, views, clicks, ctr, cpc, orders, cr | Ad campaign statistics |
| `WbAdNote` | campaign_id, text | Notes for ad campaigns |
| `WbFinancialStat` | date, sale, return_amount, logistics, storage, penalty | Financial breakdown |
| `MarketplaceSale` | sku, date, quantity, revenue, commission | Sale records |
| `SkuMapping` | internal_sku, marketplace, external_sku | Cross-platform SKU mapping |

### Operations

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `ProductionOrder` | kit_id, quantity, status, planned_date | Production orders |
| `Employee` | name, position, salary | Staff records |
| `QcChecklist` | name, items (JSONB) | Quality control templates |
| `QcInspection` | checklist_id, production_order_id, results, status | QC inspections |
| `SalesChannel` | name, type, commission_rate | Sales channel definitions |
| `MarginCalculation` | kit_id, channel_id, calculations (JSONB) | Margin analysis |

## Architecture Decisions

### Database

- **`synchronize: false`** — schema changes via direct SQL on Supabase, NOT TypeORM auto-sync.
- **UUID primary keys** on all entities.
- **Supabase pooler** (`aws-1-ap-southeast-1.pooler.supabase.com`). The direct host (`db.<ref>.supabase.co`) is deprecated for this project.
- **Max 10 connections** to prevent Supabase pool exhaustion.

### Frontend

- **Lazy-loaded pages** via `React.lazy()` + `Suspense` for code splitting.
- **No global state** — each page manages its own state via `useState` + API calls.
- **Axios client** with base URL from `VITE_API_URL` and error interceptors.
- **Vite proxy**: `/api` → `http://localhost:3001` in development.

### Backend

- **Express** with Helmet, CORS, Morgan.
- **Vercel-compatible** — exports `app` as default for serverless.
- **File uploads** served from `/uploads` static directory.

## Design System

| Token | Value |
|-------|-------|
| Primary | `#836efe` (purple/violet) |
| Gradient | `rgba(141,103,255,1)` → `rgba(200,86,255,1)` |
| Dark accent | `#6703ff` |
| Text | `#1c1528` |
| Text secondary | `#524667` |
| Border | `#e8e5ef` |
| Surface | `#f8f7fa` |
| Border radius | `40px` cards, `55px` large buttons |
| Font | Arial |

CSS utility classes: `card`, `btn`, `btn-primary`, `btn-secondary`, `input`, `label`.

## Conventions

- **All UI text in Russian** — labels, buttons, errors, placeholders.
- **Currency: `₽`** (never `$`).
- **Number format:** `Intl.NumberFormat('ru-RU')` with 2 decimal places.
- **UUID primary keys** everywhere.
- **RESTful API** at `/api/*`.
- **TypeORM decorators** for entities.
- **Functional components + hooks** only.

## Adding a New Feature

### Backend

1. Create entity: `backend/src/entities/NewEntity.ts` (UUID PK, `@Entity`, `@Column`)
2. Register in `config/database.ts` entities array
3. Run SQL `CREATE TABLE` on Supabase (no synchronize)
4. Create controller: `backend/src/controllers/new.controller.ts`
5. Create routes: `backend/src/routes/new.routes.ts`
6. Mount in `server.ts`: `app.use('/api/new', newRoutes)`

### Frontend

1. Add API module: `frontend/src/api/new.ts` (interface + CRUD functions via apiClient)
2. Create page: `frontend/src/pages/New.tsx`
3. Add lazy route in `App.tsx`
4. Create modal/form components in `components/` if needed

## Deployment

Backend exports a Vercel-compatible handler:

```typescript
export default app; // Vercel serverless
app.listen(PORT);   // Long-running server
```

```bash
cd backend && npm run build   # → dist/
cd frontend && npm run build  # → dist/
```

Frontend expects `VITE_API_URL` to point to the deployed backend in production.
