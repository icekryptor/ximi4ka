# XimFinance — Product Requirements Document (PRD)

**Product:** XimFinance — Финансовая система управления для Ximi4ka
**Version:** 1.0 (Production-Ready)
**Date:** 2026-03-09
**Status:** Draft for approval

---

## 1. PRODUCT VISION

XimFinance — единая система финансового управления для компании Ximi4ka (производство наборов для химических экспериментов). Система покрывает полный цикл: от закупки компонентов до аналитики продаж на маркетплейсах, включая себестоимость, юнит-экономику, производство и контроль качества.

**Target users:** Финансовый менеджер, операционный директор, менеджер маркетплейсов, менеджер производства (1-5 пользователей).

---

## 2. CURRENT STATE ANALYSIS

### 2.1 What EXISTS and WORKS

| Module | Status | Completeness |
|--------|--------|-------------|
| Transactions (income/expense) | Working | 90% — CRUD, import/export XLSX, filtering |
| Categories & Counterparties | Working | 95% — full CRUD |
| Components catalog | Working | 85% — CRUD, composite assembly, image upload, bulk import |
| Kit cost calculation | Working | 85% — component tree, category breakdown, estimated cost |
| Supplies management | Working | 80% — CRUD with items, document upload |
| Financial reports (P&L, Cash Flow, Balance) | Working | 75% — basic reports functional |
| Marketplace sales | Working | 70% — CRUD, import, analytics |
| WB Ads integration | Working | 70% — API sync, analytics, notes |
| WB Finance integration | Working | 65% — API sync, basic analytics |
| Unit Economics calculator | Working | 80% — multi-channel, save/load, variable blocks |
| Production Orders | Working | 60% — CRUD, status flow (NOT in sidebar) |
| QC Checklists & Inspections | Working | 60% — CRUD, stats (NOT in sidebar) |
| Employees | Working | 50% — CRUD with photo (NOT in sidebar) |
| Sales Channels config | Working | 60% — CRUD (NOT in sidebar) |
| Margin Matrix | Working | 50% — basic grid (NOT in sidebar) |

### 2.2 What is MISSING for Production

| Gap | Severity | Impact |
|-----|----------|--------|
| No authentication/authorization | CRITICAL | Anyone can access all financial data |
| No input validation framework | CRITICAL | Data integrity risk |
| No audit logging | HIGH | Cannot track who changed what |
| Native browser alerts for UX feedback | HIGH | Poor user experience |
| Inconsistent error handling | HIGH | Silent failures, lost data |
| No mobile responsiveness | MEDIUM | Desktop-only usage |
| Hidden pages (Production, QC, Employees, Channels) | MEDIUM | Features exist but inaccessible |
| Design system deviation (border-radius) | MEDIUM | Doesn't match brand identity |
| No data backup/export strategy | HIGH | Risk of data loss |
| WB API token stored in memory | HIGH | Token lost on restart |
| No rate limiting | MEDIUM | API abuse risk |
| No pagination on most endpoints | MEDIUM | Performance degrades with data growth |

---

## 3. PRODUCTION-READY PRODUCT DEFINITION

### 3.1 Core Modules (Must-Have for v1.0)

#### M1: Authentication & Security
- Login page with email/password
- JWT-based session management
- Protected API routes (middleware)
- Secure token storage (WB API tokens encrypted in DB)
- CORS hardening for production domains

#### M2: Dashboard (Redesigned)
- KPI cards: revenue, expenses, profit, margin (current month vs previous)
- Quick charts: revenue trend (last 6 months), expense breakdown
- Production status summary (orders by status)
- WB sales summary (today/week/month)
- Quick actions: new transaction, new supply, new order

#### M3: Cost Management (Polish)
- Components: complete CRUD with validation, image management
- Kits: cost calculation with auto-refresh on component changes
- Assembly tree: visual improvements, expand/collapse all
- Cost history tracking (when component prices change)

#### M4: Supply Chain (Complete)
- Supplies with auto-cost-sync to components
- Document management with preview
- Supply history per component
- Automatic transaction creation on supply

#### M5: Financial Accounting (Harden)
- Transactions with robust validation
- Import/export with error recovery
- Financial reports: P&L, Cash Flow, Balance Sheet
- Report export to PDF/XLSX
- Category/counterparty analytics with charts

#### M6: Marketplace Integration (Stabilize)
- WB Ads sync with persistent token storage
- WB Finance sync with error handling and retry
- Sales analytics dashboards with proper charts
- SKU mapping management
- Multi-marketplace support (WB primary, Ozon prepared)

#### M7: Unit Economics & Margins (Complete)
- Calculator with all variable blocks
- Save/load/clone calculations
- Margin matrix (all kits × all channels)
- Comparison view (before/after price changes)

#### M8: Production Management (Activate)
- Add to navigation sidebar
- Production orders with full status workflow
- QC checklists per kit
- QC inspections with defect tracking
- Production dashboard (orders by status, QC pass rate)

#### M9: HR & Configuration (Activate)
- Employee management in sidebar
- Sales channels configuration in sidebar
- Rate management for labor cost calculations

#### M10: UX/UI Overhaul
- Toast notification system (replace all native alerts)
- Consistent confirmation dialogs (replace native confirm())
- Design system compliance (40-55px border radius, glassmorphic cards)
- Loading skeletons instead of spinners
- Form validation with inline error messages
- Responsive sidebar (collapsible on mobile)
- Empty states for all lists/tables
- Keyboard shortcuts for power users

### 3.2 Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| Page load time | < 2s on 4G |
| API response time | < 500ms (p95) |
| Concurrent users | 5 simultaneous |
| Data retention | Unlimited (Supabase) |
| Browser support | Chrome 90+, Safari 16+, Firefox 90+ |
| Uptime | 99% (Supabase SLA) |
| Backup | Daily automatic (Supabase) |

---

## 4. SPRINT PLAN

### Sprint 0: Foundation & Infrastructure (3 days)
**Goal:** Establish production infrastructure, fix critical gaps

#### User Stories

**S0-1: Authentication System**
- US: Как пользователь, я хочу входить в систему по email/паролю, чтобы мои данные были защищены
- Tasks:
  - [BE] Create User entity (id, email, password_hash, name, role, is_active)
  - [BE] Auth controller: POST /auth/login, POST /auth/register, GET /auth/me
  - [BE] JWT middleware for route protection
  - [BE] Protect all existing routes with auth middleware
  - [FE] Login page with form validation
  - [FE] Auth context provider (store token, auto-redirect)
  - [FE] Protected route wrapper component
  - [QA] Test login/logout flow, token expiry, unauthorized access

**S0-2: Toast Notification System**
- US: Как пользователь, я хочу видеть понятные уведомления о результатах моих действий
- Tasks:
  - [FE] Create Toast component (success/error/warning/info variants)
  - [FE] Toast context provider with queue management
  - [FE] Replace ALL native alert() calls across entire codebase
  - [FE] Replace ALL native confirm() with ConfirmDialog component
  - [QA] Verify no native alerts remain, test toast auto-dismiss

**S0-3: Input Validation Framework**
- US: Как система, я должна отклонять некорректные данные до сохранения в БД
- Tasks:
  - [BE] Integrate class-validator with TypeORM entities
  - [BE] Create validation middleware (validateRequest)
  - [BE] Add validation decorators to all entities
  - [BE] Standardize error response format: {error, details[]}
  - [FE] Create FormField component with inline validation
  - [FE] Add client-side validation to all forms
  - [QA] Test boundary values, required fields, type mismatches

**S0-4: Navigation Activation**
- US: Как пользователь, я хочу видеть все доступные разделы системы в меню
- Tasks:
  - [FE] Add to sidebar: Производство, Контроль качества, Сотрудники, Каналы продаж, Матрица маржи
  - [FE] Reorganize sidebar groups: Экономика, Финансы, Производство, Маркетплейсы, Настройки
  - [UX] Design sidebar group icons and ordering
  - [QA] Verify all routes accessible, active states correct

---

### Sprint 1: UX/UI Overhaul (4 days)
**Goal:** Bring UI to production quality, implement design system

#### User Stories

**S1-1: Design System Implementation**
- US: Как бренд Ximi4ka, интерфейс должен соответствовать фирменному стилю
- Tasks:
  - [UX] Audit all components for design system compliance
  - [FE] Update Tailwind config: custom border-radius (rounded-card: 40px, rounded-btn: 32px)
  - [FE] Create glassmorphic card component (backdrop-blur, border, shadow)
  - [FE] Apply design tokens globally: colors, spacing, typography
  - [FE] Update all page layouts with new card system
  - [QA] Visual regression check on all pages

**S1-2: Reusable Component Library**
- US: Как разработчик, я хочу использовать стандартные компоненты для единообразного UI
- Tasks:
  - [FE] Extract FormField component (label + input + error + hint)
  - [FE] Extract DataTable component (sortable headers, pagination, empty state)
  - [FE] Extract StatCard component (icon + value + label + trend)
  - [FE] Extract PageHeader component (title + actions + breadcrumb)
  - [FE] Extract ConfirmDialog component (title + message + actions)
  - [FE] Extract EmptyState component (icon + message + action)
  - [QA] Storybook-style verification of all components

**S1-3: Loading & Empty States**
- US: Как пользователь, я хочу понимать состояние страницы (загрузка, пусто, ошибка)
- Tasks:
  - [FE] Create skeleton loading components for tables, cards, forms
  - [FE] Add empty states to all list pages ("Нет данных", with action button)
  - [FE] Add error boundary with retry button per page section
  - [FE] Replace all spinner-only loaders with skeletons
  - [QA] Test slow network, empty database, API errors

**S1-4: Responsive Layout**
- US: Как пользователь, я хочу пользоваться системой с планшета
- Tasks:
  - [UX] Design collapsible sidebar for tablet/mobile
  - [FE] Implement hamburger menu + slide-out sidebar
  - [FE] Make all tables horizontally scrollable with sticky first column
  - [FE] Stack form columns on small screens
  - [FE] Test on 768px and 1024px breakpoints
  - [QA] Test all pages on tablet viewport

---

### Sprint 2: Core Financial Hardening (4 days)
**Goal:** Make financial modules production-reliable

#### User Stories

**S2-1: Transaction Management Polish**
- US: Как финансовый менеджер, я хочу надёжно вести учёт доходов и расходов
- Tasks:
  - [BE] Add pagination to all list endpoints (standardized: page, limit, sort)
  - [BE] Add transaction validation (positive amounts, valid dates, required category)
  - [FE] Improve transaction table: inline date range picker, multi-filter chips
  - [FE] Add bulk delete with confirmation
  - [FE] Fix XLSX import error handling (show row-level errors)
  - [QA] Test import with malformed data, large files, duplicates

**S2-2: Financial Reports Enhancement**
- US: Как директор, я хочу видеть финансовые отчёты с графиками и экспортом
- Tasks:
  - [BE] Add chart data endpoints (time series for revenue, expenses)
  - [FE] Add charts to P&L report (revenue vs expenses bar chart)
  - [FE] Add charts to Cash Flow (cumulative line chart)
  - [FE] Add export to XLSX for all financial reports
  - [FE] Add date range presets (this month, quarter, year, custom)
  - [QA] Verify report calculations match raw transaction sums

**S2-3: Dashboard Redesign**
- US: Как пользователь, я хочу видеть ключевые показатели на главной странице
- Tasks:
  - [UX] Design dashboard layout: 4 KPI cards + 2 charts + activity feed
  - [FE] KPI cards: Выручка, Расходы, Прибыль, Маржа (с трендом vs прошлый месяц)
  - [FE] Revenue trend chart (6 months)
  - [FE] Expense breakdown pie chart
  - [FE] Recent activity list (last 10 transactions + orders)
  - [FE] Quick action buttons
  - [QA] Test with empty data, single month data, full year data

---

### Sprint 3: Supply Chain & Cost Management (3 days)
**Goal:** Complete supply chain and cost tracking

#### User Stories

**S3-1: Supply Workflow Completion**
- US: Как менеджер закупок, я хочу видеть историю поставок и автоматическое обновление цен
- Tasks:
  - [BE] Auto-trigger syncComponentCosts after supply creation/update
  - [BE] Add supply cost history endpoint (price changes over time per component)
  - [FE] Supply detail page with item breakdown and document preview
  - [FE] Component cost history chart (price timeline)
  - [QA] Test cost sync cascade: supply → component → composite → kit

**S3-2: Kit Cost Calculation Hardening**
- US: Как финансист, я хочу видеть точную и актуальную себестоимость каждого набора
- Tasks:
  - [BE] Auto-recalculate kit costs when component costs change
  - [BE] Add cost snapshot history (track kit cost over time)
  - [FE] Cost calculation page: add "recalculate all" button
  - [FE] Show cost delta badges (↑↓ since last calculation)
  - [FE] Assembly tree: improve UX (expand/collapse, search)
  - [QA] Test circular dependency prevention, large assembly trees

---

### Sprint 4: Marketplace & Unit Economics (4 days)
**Goal:** Stabilize marketplace integration, complete economics tools

#### User Stories

**S4-1: WB Integration Stabilization**
- US: Как менеджер маркетплейсов, я хочу надёжную синхронизацию данных с Wildberries
- Tasks:
  - [BE] Store WB API tokens in database (encrypted)
  - [BE] Add retry logic with exponential backoff for WB API calls
  - [BE] Add sync error logging and partial sync recovery
  - [BE] Background sync scheduling (last sync + status tracking)
  - [FE] Sync status dashboard (last sync time, errors, data freshness)
  - [FE] WB Finance page: complete missing visualizations
  - [QA] Test sync with invalid token, API timeouts, partial data

**S4-2: Unit Economics & Margin Matrix**
- US: Как директор, я хочу понимать маржинальность каждого товара на каждом канале
- Tasks:
  - [FE] Margin matrix: add color coding (green/yellow/red by margin%)
  - [FE] Margin matrix: add to sidebar navigation
  - [FE] Unit economics: comparison mode (side-by-side two scenarios)
  - [FE] Unit economics: auto-fill from actual costs (latest kit cost + channel config)
  - [BE] Margin matrix endpoint optimization (single query instead of N+1)
  - [QA] Test with all kits × all channels, verify calculations

**S4-3: Sales Analytics Dashboard**
- US: Как менеджер, я хочу видеть аналитику продаж с графиками и трендами
- Tasks:
  - [FE] Sales analytics: revenue trend chart by marketplace
  - [FE] Sales analytics: top products by revenue/margin
  - [FE] Sales analytics: WB ads ROI integration (ad spend vs revenue)
  - [FE] Combined view: sales + ads + finance in one dashboard
  - [QA] Test date range filters, empty states, data consistency

---

### Sprint 5: Production & Quality Control (3 days)
**Goal:** Activate and polish production management

#### User Stories

**S5-1: Production Orders Workflow**
- US: Как менеджер производства, я хочу управлять заказами от создания до отгрузки
- Tasks:
  - [UX] Design Kanban-style board for order statuses
  - [FE] Production orders page: Kanban view with drag-and-drop status change
  - [FE] Order detail view: kit info, QC results, cost tracking
  - [FE] Production dashboard: orders by status chart, completion rate
  - [BE] Order status change validation (enforce allowed transitions)
  - [QA] Test full order lifecycle, invalid status transitions

**S5-2: Quality Control System**
- US: Как контролёр качества, я хочу проводить проверки по чек-листам и фиксировать дефекты
- Tasks:
  - [FE] QC inspection form: checklist with pass/fail per item
  - [FE] Defect photo upload with description
  - [FE] QC statistics dashboard: pass rate trends, defect categories
  - [FE] Link QC results to production order (visual indicators)
  - [QA] Test inspection creation, photo upload, stats accuracy

---

### Sprint 6: Polish & Launch Prep (3 days)
**Goal:** Final quality pass, deployment preparation

#### User Stories

**S6-1: Error Handling & Edge Cases**
- US: Как система, я должна корректно обрабатывать все ошибки
- Tasks:
  - [BE] Global error handler improvement (structured errors, request IDs)
  - [BE] Add rate limiting to all endpoints
  - [FE] Offline detection with "reconnecting" banner
  - [FE] Session expiry handling (auto-redirect to login)
  - [QA] Chaos testing: kill backend, slow network, expired token

**S6-2: Data Integrity & Audit**
- US: Как директор, я хочу знать кто и когда изменял финансовые данные
- Tasks:
  - [BE] Add created_by/updated_by to Transaction, Supply, ProductionOrder
  - [BE] Soft delete for critical entities (is_deleted flag instead of DELETE)
  - [BE] Audit log table (entity, action, user, timestamp, changes JSON)
  - [FE] Show "последнее изменение: [user] [date]" on detail views
  - [QA] Verify audit trail completeness

**S6-3: Performance & Final Polish**
- US: Как пользователь, я хочу чтобы система работала быстро
- Tasks:
  - [BE] Add database indexes for slow queries
  - [BE] Implement query result caching for reports
  - [FE] Lazy loading for all pages (already done via React.lazy)
  - [FE] Image optimization (component photos, employee photos)
  - [FE] Final UX audit: consistent spacing, alignment, typography
  - [QA] Performance testing: 1000 transactions, 100 components, 50 kits

**S6-4: Deployment**
- Tasks:
  - [BE] Production environment config (Railway/Vercel)
  - [BE] Database migration scripts (instead of synchronize)
  - [FE] Production build optimization
  - [FE] Environment-specific API URLs
  - [QA] Smoke test on production: all CRUD operations, imports, syncs

---

## 5. SPRINT SUMMARY

| Sprint | Duration | Focus | Key Deliverable |
|--------|----------|-------|-----------------|
| Sprint 0 | 3 days | Foundation | Auth + Toasts + Validation + Nav |
| Sprint 1 | 4 days | UX/UI | Design system + Components + Responsive |
| Sprint 2 | 4 days | Finance | Reports + Dashboard + Transaction polish |
| Sprint 3 | 3 days | Supply Chain | Cost sync + Kit calculation + History |
| Sprint 4 | 4 days | Marketplace | WB stability + Unit Economics + Analytics |
| Sprint 5 | 3 days | Production | Kanban orders + QC system |
| Sprint 6 | 3 days | Launch | Error handling + Audit + Performance + Deploy |
| **TOTAL** | **24 days** | | **Production-ready v1.0** |

---

## 6. AGENT RESPONSIBILITIES

### Developer Agent
- Backend: entities, controllers, routes, middleware, database
- Frontend: page logic, API integration, state management
- Owns: all [BE] and [FE] tasks

### UX/UI Agent
- Design system enforcement
- Component visual quality
- Layout and responsive design
- Owns: all [UX] tasks, reviews all [FE] visual output

### QA/Debug Agent
- Functional testing of all user stories
- Edge case and error scenario testing
- Performance verification
- Owns: all [QA] tasks, validates every sprint deliverable

---

## 7. SUCCESS CRITERIA

v1.0 is production-ready when:
- [ ] All pages accessible via sidebar navigation
- [ ] Authentication protects all routes
- [ ] All CRUD operations have validation + error feedback (toasts)
- [ ] Financial reports are accurate and exportable
- [ ] WB sync is reliable with error recovery
- [ ] Unit economics calculator produces correct margins
- [ ] Production orders flow through complete lifecycle
- [ ] QC inspections linked to production orders
- [ ] Design system applied consistently (brand colors, rounded corners)
- [ ] No native alert()/confirm() calls remain
- [ ] All list pages have pagination, loading states, empty states
- [ ] Tablet-responsive layout works at 768px+
