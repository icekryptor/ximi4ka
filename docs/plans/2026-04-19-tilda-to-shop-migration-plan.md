# Tilda → Self-Hosted Storefront Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted e-commerce storefront to replace the current Tilda site, integrated with the existing XimERP via a paid-order notification endpoint.

**Architecture:** New monorepo `ximi4ka-shop` (sibling to this repo) with two deployable services — `web/` (Next.js 15 App Router, storefront + admin) and `api/` (Node + Express + TypeORM on a separate Supabase Postgres). Storefront owns catalog; ERP receives paid orders and forwards to existing Telegram bot. Yandex Pay as priority payment method. Soft cutover via `shop.ximi4ka.ru` subdomain, later DNS swap + 301 map.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, TailwindCSS v4, Tiptap (WYSIWYG), Node + Express, TypeORM, PostgreSQL (Supabase), argon2 (admin auth), Yandex Pay Checkout API, Supabase Storage (images), Vitest + Playwright (tests), Sentry, Vercel (web) + Fly.io or Railway (api).

> **Note:** Plan originally said "Next.js 15" but `create-next-app@latest` installed Next.js 16.2.4 (current stable) during Task 0.4. Dispatcher policy was "accept latest; don't downgrade."

**Design doc:** [2026-04-19-tilda-to-shop-migration-design.md](2026-04-19-tilda-to-shop-migration-design.md)

---

## Phased Overview

The work splits into nine phases. **Phases 0–2 are locally executable** with no external accounts. Phases 3+ require credentials the owner provisions (see "External Prerequisites" below).

| Phase | Title | External deps needed | Can start autonomously? |
|---|---|---|---|
| 0 | Repo scaffolding & tooling | None (local git) | **Yes** |
| 1 | Shop DB schema + API CRUD (products, categories, pages) | Local Postgres via Docker | **Yes** |
| 2 | Public storefront — catalog, product page, cart | None | **Yes** |
| 3 | Admin panel + WYSIWYG | None (but needs Supabase Storage for images in prod) | Partial — local-disk fallback OK |
| 4 | Checkout + Yandex Pay integration | **Yandex Pay merchant account + credentials** | **No — blocked** |
| 5 | ERP integration (inbound orders + Telegram) | ERP deploy target + shared secret | **No — blocked** |
| 6 | SEO + GEO (JSON-LD, sitemap, robots, llms.txt, Metrika) | None for code; verification IDs needed for launch | Partial |
| 7 | AMP + Turbo + YML feed | None for code | **Yes** |
| 8 | i18n plumbing (RU launch, EN-ready) | None | **Yes** |
| 9 | Cutover (staging deploy, 301 map, DNS, observability) | **Vercel + Fly/Railway + Sentry + domain DNS + Tilda URL export** | **No — blocked** |

## External Prerequisites (owner must provide before Phases 4/5/9)

1. Yandex Pay merchant account — contract, API key, secret key, sandbox credentials first.
2. New GitHub repo `ximi4ka-shop` (can also be local-only until push is needed).
3. New Supabase project for the shop DB.
4. DNS control for `shop.ximi4ka.ru` and `api.shop.ximi4ka.ru`.
5. Yandex Webmaster / Яндекс.Метрика / Google Search Console / GA4 — verification IDs (needed only at cutover, not for dev).
6. Tilda URL export + top-traffic list from Metrika (for 301 map).
7. Accounts: Sentry, Vercel, Fly.io or Railway.
8. Shared-secret env value for the ERP `orders/inbound` endpoint.

## Execution Posture

- **TDD throughout.** Each feature: failing test → minimal impl → pass → commit.
- **Frequent commits.** Smallest reasonable unit, with conventional-commit subject line.
- **Russian UI text** (project convention per CLAUDE.md).
- **New repo location:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/` (sibling to this repo). This is a deliberate move outside the current working tree.

---

## Phase 0 — Repo Scaffolding & Tooling

**Goal:** Create the new repo, initialize `web/` and `api/` workspaces, set up shared TypeScript config, install baseline dependencies, wire up lint/format/test tooling, and land a green CI config in `main`. Everything passes with zero feature code.

### Task 0.1: Create monorepo skeleton

**Files:**
- Create: `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/.gitignore`
- Create: `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/README.md` (one paragraph; link back to design doc)
- Create: `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/package.json` (workspaces for `web`, `api`, `shared`)
- Create: `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/tsconfig.base.json`

**Step 1:** `mkdir ximi4ka-shop && cd ximi4ka-shop && git init`
**Step 2:** Write root `package.json` with npm workspaces `["web", "api", "shared"]`, `"private": true`, Node `>=20`.
**Step 3:** Write `.gitignore` (node_modules, `.env*`, `.next/`, `dist/`, `.vercel/`, `.DS_Store`).
**Step 4:** Write `tsconfig.base.json` with `strict: true`, `target: ES2022`, `moduleResolution: "bundler"`.
**Step 5:** Commit: `chore: initialize ximi4ka-shop monorepo skeleton`.

### Task 0.2: Scaffold `shared/` workspace

**Files:**
- Create: `ximi4ka-shop/shared/package.json`
- Create: `ximi4ka-shop/shared/tsconfig.json` (extends base)
- Create: `ximi4ka-shop/shared/src/index.ts` (exports `{}` for now)
- Create: `ximi4ka-shop/shared/src/types/order.ts` — `OrderDto` interface matching design doc fields
- Create: `ximi4ka-shop/shared/src/types/product.ts` — `Product`, `ProductImage`, `StockStatus` types
- Test: `ximi4ka-shop/shared/src/types/order.test.ts` — compile-time type assertion

**Steps:** TDD a trivial type-level test (`expectType<OrderDto['status']>().toEqualTypeOf<'pending' | 'paid' | 'failed' | 'cancelled'>()` via `vitest` + `expect-type`). Run, verify pass. Commit.

### Task 0.3: Scaffold `api/` workspace

**Files:**
- Create: `ximi4ka-shop/api/package.json` (express, typeorm, pg, argon2, pino, vitest, supertest)
- Create: `ximi4ka-shop/api/tsconfig.json`
- Create: `ximi4ka-shop/api/src/index.ts` (Express app factory + `/health` endpoint returning `{ ok: true }`)
- Create: `ximi4ka-shop/api/src/app.ts` (separates app creation from listen, for testability)
- Test: `ximi4ka-shop/api/src/app.test.ts` (`GET /health` returns 200 + `{ ok: true }`)

**Steps:** Red (`vitest run` — fails: no handler). Green (add handler). Run. Commit: `feat(api): scaffold Express app with /health endpoint`.

### Task 0.4: Scaffold `web/` workspace (Next.js 15)

**Files:**
- Create: `ximi4ka-shop/web/` via `npx create-next-app@latest web --app --typescript --tailwind --eslint --no-src-dir --import-alias "@/*"` (run in `ximi4ka-shop/`)
- Modify: `ximi4ka-shop/web/app/page.tsx` — replace default content with "Магазин Ximi4ka" H1 placeholder
- Modify: `ximi4ka-shop/web/package.json` — align React/Next versions, add `vitest`, `@testing-library/react`
- Create: `ximi4ka-shop/web/app/page.test.tsx` — renders the heading

**Steps:** Run `create-next-app`. Red (add test before content edit). Green. Commit: `feat(web): scaffold Next.js app`.

### Task 0.5: Monorepo-wide tooling

**Files:**
- Create: `ximi4ka-shop/.editorconfig`
- Create: `ximi4ka-shop/.prettierrc`
- Create: `ximi4ka-shop/.prettierignore`
- Modify: root `package.json` — add scripts `"lint": "npm run lint -ws --if-present"`, `"test": "npm run test -ws --if-present"`, `"typecheck": "npm run typecheck -ws --if-present"`
- Add `"typecheck": "tsc --noEmit"` to each workspace's `package.json`

**Steps:** Run `npm install` at root, `npm run typecheck`, `npm run test`, `npm run lint`. All must pass. Commit: `chore: add monorepo lint/format/test tooling`.

### Task 0.6: CI (GitHub Actions)

**Files:**
- Create: `ximi4ka-shop/.github/workflows/ci.yml` — matrix on Node 20/22, runs `typecheck`, `lint`, `test` per workspace.

**Steps:** Write workflow. Verify it's syntactically valid with `act` or by pushing to a branch later. Commit: `ci: add GitHub Actions workflow`.

### Task 0.7: Environment config

**Files:**
- Create: `ximi4ka-shop/api/.env.example` — `DATABASE_URL`, `PORT`, `ADMIN_SESSION_SECRET`, `ERP_INBOUND_URL`, `ERP_SHARED_SECRET`, `YANDEX_PAY_API_KEY`, `YANDEX_PAY_SECRET`, `SENTRY_DSN`, `SUPABASE_STORAGE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Create: `ximi4ka-shop/web/.env.example` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_METRIKA_ID`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_SITE_URL`.

**Steps:** Write. Commit: `chore: add .env.example files`.

---

## Phase 1 — Shop DB Schema + API CRUD

**Goal:** Local Postgres (via docker-compose), TypeORM entities matching design-doc schema, migrations, and CRUD endpoints (with validation + tests) for products, categories, and pages. Auth deferred to Phase 3.

### Task 1.1: Local Postgres via docker-compose

**Files:**
- Create: `ximi4ka-shop/docker-compose.yml` — `postgres:16` on port 5433 (avoid colliding with ERP's Postgres), volume, default creds for dev only.

**Steps:** `docker compose up -d`. Verify `psql`. Update `api/.env` with local URL. Commit: `chore: add docker-compose for local Postgres`.

### Task 1.2: TypeORM DataSource

**Files:**
- Create: `ximi4ka-shop/api/src/config/dataSource.ts`
- Modify: `ximi4ka-shop/api/package.json` — add `migration:run`, `migration:generate` scripts
- Test: `ximi4ka-shop/api/src/config/dataSource.test.ts` — DataSource initializes against local DB

**Steps:** Red/green/commit as standard TDD.

### Task 1.3: Entities — Products

**Files:**
- Create: `ximi4ka-shop/api/src/entities/Product.ts`
- Create: `ximi4ka-shop/api/src/entities/ProductImage.ts`
- Create: `ximi4ka-shop/api/src/entities/ProductCategory.ts`
- Create: `ximi4ka-shop/api/src/entities/ProductCategoryLink.ts`
- Create: migration file (generated)
- Test: `ximi4ka-shop/api/src/entities/Product.test.ts` — persist + retrieve round-trip

**Steps:** Define entity, generate migration, run against local DB, red test for round-trip, green, commit: `feat(api): add Product entity + migration`.

### Task 1.4: Entities — Pages, Orders, OrderItems, AdminUsers, EntityRevisions, Redirects

One task per entity, same TDD rhythm. Commit per entity.

### Task 1.5: Product CRUD routes

**Files:**
- Create: `ximi4ka-shop/api/src/routes/products.ts`
- Create: `ximi4ka-shop/api/src/routes/products.test.ts`

**Steps (per endpoint: list / get-by-slug / create / update / publish / delete):**
1. Red: supertest asserts on shape & status.
2. Green: implement route handler with zod validation.
3. Commit: `feat(api): products <endpoint>`.

### Task 1.6: Category + Page CRUD

Same rhythm as Task 1.5. Public `GET` endpoints only filter `is_published = true`; admin endpoints return all.

### Task 1.7: Seed script for dev data

**Files:**
- Create: `ximi4ka-shop/api/src/seeds/seed.ts` — creates 3 categories, 8 products, 4 pages, 1 admin user.

**Steps:** `npm run seed` populates. Verify via `GET /api/products`. Commit: `chore: add dev seed script`.

---

## Phase 2 — Public Storefront (Catalog, Product, Cart)

**Goal:** Shoppable site using the API from Phase 1. Still no checkout/payment — cart is `localStorage` only. Fully SSR/SSG for SEO.

### Task 2.1: API client + types shared to `web/`

**Files:**
- Create: `ximi4ka-shop/web/lib/api.ts` — fetch wrapper with typed responses
- Create: `ximi4ka-shop/web/lib/api.test.ts`

### Task 2.2: Homepage (SSG)

**Files:**
- Modify: `ximi4ka-shop/web/app/page.tsx` — fetches home `page` + featured products
- Create: `ximi4ka-shop/web/app/page.test.tsx`

### Task 2.3: Category list + detail (SSG with `generateStaticParams`)

Routes: `/categories`, `/categories/[slug]`. TDD + commit per route.

### Task 2.4: Product detail page (SSG with ISR fallback)

Route: `/product/[slug]`. Includes: gallery, short + long description (block renderer), price, "В корзину" button, stock state, breadcrumbs.

### Task 2.5: Block renderer

**Files:**
- Create: `ximi4ka-shop/web/components/blocks/BlockRenderer.tsx`
- Create: one component file per block type (`ParagraphBlock`, `ImageBlock`, `GalleryBlock`, `LayoutBlock`, `CtaBlock`, `VideoBlock`, `FaqBlock`, `ProductGridBlock`)
- Test: snapshot + props-to-DOM assertions

**TDD per block type; commit per block.**

### Task 2.6: Cart (client-side, `localStorage`)

**Files:**
- Create: `ximi4ka-shop/web/lib/cart.ts` — typed store with `add`, `remove`, `setQty`, `clear`, `subtotal`.
- Create: `ximi4ka-shop/web/lib/cart.test.ts` (Vitest, run in jsdom).
- Create: `ximi4ka-shop/web/components/CartDrawer.tsx`
- Create: `ximi4ka-shop/web/app/cart/page.tsx` (full cart page)

### Task 2.7: Layout + header + footer

Russian UI, design tokens from existing ximi4ka.ru (purple `#836efe`, etc. — see CLAUDE.md of ERP repo for reference).

---

## Phase 3 — Admin Panel + WYSIWYG

**Goal:** Admins can log in, create/edit products/categories/pages with Tiptap, upload images, and manage redirects.

### Outline (to be expanded to bite-sized tasks before execution)

- 3.1: Admin auth — argon2, session cookie, CSRF middleware, `POST /api/auth/login`, `POST /api/auth/logout`. **TDD heavy here** — auth bugs are security bugs.
- 3.2: Admin shell — `/admin/*` route group in Next.js, auth guard server component, sidebar nav (Products, Categories, Pages, Orders, Redirects, Media, Settings).
- 3.3: Product list + create/edit form. SEO fields panel. Image upload (calls `POST /api/media/upload`).
- 3.4: Tiptap WYSIWYG integration — rich text, headings, lists, links toolbar.
- 3.5: Block editor — add/remove/reorder blocks; each block type has its own inline editor; live-preview pane using public `BlockRenderer`.
- 3.6: Category tree editor.
- 3.7: Page list + editor (reuses block editor from 3.5).
- 3.8: Media library.
- 3.9: Redirects table CRUD + CSV import.
- 3.10: Revision history + restore.
- 3.11: Site settings (analytics IDs, robots.txt content, llms.txt content, YML feed metadata, Yandex Pay toggle/mode).

**Image storage:** in dev, local disk under `api/uploads/`. In prod, Supabase Storage — adapter interface in API so swap is one env-var change.

---

## Phase 4 — Checkout + Yandex Pay

**Goal:** Working paid-order flow end-to-end against Yandex Pay sandbox.

**BLOCKED pending Yandex Pay sandbox credentials.**

### Outline

- 4.1: Checkout page UI — customer form + delivery method + order summary.
- 4.2: `POST /api/checkout` — server-side price/stock recompute, zod validation, idempotency on client `Idempotency-Key` header, creates `pending` order, calls Yandex Pay create-payment API, returns `{ order_number, payment_url }`.
- 4.3: Yandex Pay webhook handler — `POST /api/webhooks/yandex-pay`, signature verification, idempotent on `payment_intent_id`, marks order paid, enqueues ERP-sync job.
- 4.4: Order status endpoint + pending/success pages with polling.
- 4.5: Reconciliation job — every 5 min, polls Yandex Pay status for `pending > 2min` orders.
- 4.6: Integration tests with mocked Yandex Pay client.
- 4.7: One real ₽1 sandbox purchase-and-refund manual QA.

**Technology note:** before writing Yandex Pay client code, query **context7** for current Yandex Pay Checkout API docs; do not rely on training data here, the API has changed recently.

---

## Phase 5 — ERP Integration

**Goal:** Paid orders reach the Telegram bot via the existing ERP.

### Outline

- 5.1: In **this** repo (ERP): add `POST /api/internal/orders/inbound` endpoint with shared-secret auth. Idempotent on `order_number`. Forwards formatted message via existing Telegram integration (`backend/src/routes/...` — inspect before writing). Separate follow-up task-list in the ERP repo; this plan tracks it from the shop side.
- 5.2: In shop `api/`: sync job with retry ladder (1m, 5m, 30m, 2h, 12h), exponential backoff lib or BullMQ-on-Postgres.
- 5.3: Fallback direct-to-Telegram notification (shop-owned bot token) after retries exhausted.
- 5.4: Admin UI — order list shows `erp_synced_at`; "Resync" button hits `POST /api/orders/:id/resync-erp`.
- 5.5: Integration tests — ERP-500 path, retries, fallback.

**BLOCKED pending:** shared-secret env value + ERP deploy coordination.

---

## Phase 6 — SEO + GEO

**Goal:** Every public route emits correct meta tags, JSON-LD, sitemap entry, and renders fast.

### Outline

- 6.1: Next.js `generateMetadata` helpers per page type — product, category, page, homepage.
- 6.2: JSON-LD generators — `Product`, `ItemList`, `Article`, `BreadcrumbList`, `FAQPage`, `Organization`, `WebSite` + `SearchAction`. Unit-tested with schema-validation against schema.org examples.
- 6.3: `/sitemap.xml` route with lazy pagination (<50k URLs) + `hreflang` alternates.
- 6.4: `/robots.txt` route (admin-editable content).
- 6.5: `/llms.txt` route (admin-editable content).
- 6.6: Яндекс.Метрика + GA4 injection (from site settings).
- 6.7: Open Graph / Twitter card tags.
- 6.8: Core Web Vitals audit on key pages — Lighthouse CI or WebPageTest; treat <90 mobile as a bug.
- 6.9: SEO regression test suite (Vitest + Playwright snapshot).

---

## Phase 7 — AMP + Turbo + YML Feed

### Outline

- 7.1: AMP route group — `/amp/product/[slug]`, `/amp/article/[slug]`. Strip interactive JS, use AMP components.
- 7.2: AMP validator in CI (fails build on invalid AMP).
- 7.3: `<link rel="amphtml">` injection on canonical pages.
- 7.4: Yandex Turbo RSS endpoint — `/turbo.xml`. Shared content source with AMP.
- 7.5: YML feed — `GET /yml.xml`. XML generator from `products` + settings. Cached, invalidated on product save.
- 7.6: YML XSD validation in admin "Preview YML" action.
- 7.7: Integration tests for all three feeds.

---

## Phase 8 — i18n Plumbing

### Outline

- 8.1: Next.js locale routing — `/ru/*` (default, no-prefix-fallback TBD).
- 8.2: `translations` JSONB on products/categories/pages — migration, entity update, CRUD validation.
- 8.3: Admin UI — language tabs with completeness indicator.
- 8.4: `hreflang` alternates in `<head>` + sitemap.
- 8.5: **RU-only content at launch.** Verify EN locale renders the default locale when no translation exists (fallback behavior), no broken pages.

---

## Phase 9 — Cutover

**BLOCKED pending external accounts + Tilda URL export.**

### Outline

- 9.1: Deploy `web/` to Vercel on `shop.ximi4ka.ru`.
- 9.2: Deploy `api/` to Fly.io (or Railway) on `api.shop.ximi4ka.ru`.
- 9.3: Configure production env vars on both.
- 9.4: Wire Sentry on `web` + `api`.
- 9.5: Set up uptime monitoring (UptimeRobot or equivalent) on both domains + YML feed URL.
- 9.6: Import Tilda URL export → `redirects` table via CSV.
- 9.7: Verify Yandex Webmaster + Search Console + Метрика + GA4.
- 9.8: Production Yandex Pay credentials (not sandbox) — one real ₽1 purchase + refund.
- 9.9: End-to-end Telegram delivery via production ERP sync path.
- 9.10: Parallel-run period — monitor Metrika on both sites.
- 9.11: DNS swap — apex `ximi4ka.ru` → new storefront; `shop.` becomes alias.
- 9.12: Post-launch 404 audit in Yandex Webmaster; add missing redirects.

---

## Notes on Plan Granularity

Phases 0–2 have bite-sized TDD tasks because they're what we'll execute first. Phases 3–9 are outlined; each phase will be expanded into bite-sized tasks **before that phase starts**, not all upfront. This avoids writing 2000 lines of plan that go stale before they're read, and lets early-phase learnings shape later tasks.

When a phase is ready to start, the executing-plans skill will expand the outline into the standard TDD-style step list.
