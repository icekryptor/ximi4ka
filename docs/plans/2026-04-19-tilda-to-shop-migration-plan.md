# Tilda → Self-Hosted Storefront Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted e-commerce storefront to replace the current Tilda site, integrated with the existing XimERP via a paid-order notification endpoint.

**Architecture:** New monorepo `ximi4ka-shop` (sibling to this repo) with two deployable services — `web/` (Next.js 15 App Router, storefront + admin) and `api/` (Node + Express + TypeORM on a separate Supabase Postgres). Storefront owns catalog; ERP receives paid orders and forwards to existing Telegram bot. Yandex Pay as priority payment method. Soft cutover via `shop.ximi4ka.ru` subdomain, later DNS swap + 301 map.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, TailwindCSS v4, Tiptap (WYSIWYG), Node + Express, TypeORM, PostgreSQL (Supabase), argon2 (admin auth), Yandex Pay Checkout API, Supabase Storage (images), Vitest + Playwright (tests), Sentry, Vercel (web) + Fly.io or Railway (api).

> **Note:** Plan originally said "Next.js 15" but `create-next-app@latest` installed Next.js 16.2.4 (current stable) during Task 0.4. Dispatcher policy was "accept latest; don't downgrade."

**Design doc:** [2026-04-19-tilda-to-shop-migration-design.md](2026-04-19-tilda-to-shop-migration-design.md)

---

## Phased Overview

The work splits into nine phases. **Phases 0–3 are complete.** Current HEAD: `a14f00e`. **438 tests passing** (web 303, api 129, shared 6).

| Phase | Title | Status | External deps |
|---|---|---|---|
| 0 | Repo scaffolding & tooling | ✅ **Complete** | — |
| 1 | Shop DB schema + API CRUD | ✅ **Complete** | — |
| 2 | Public storefront — catalog, product page, cart | ✅ **Complete** | — |
| 3 | Admin panel + WYSIWYG + settings | ✅ **Complete** | — |
| 4 | Checkout + Yandex Pay integration | ⛔ **Blocked** | Yandex Pay merchant credentials |
| 5 | ERP integration (inbound orders + Telegram) | ⛔ **Blocked** | ERP deploy target + shared secret |
| 6 | SEO + GEO (JSON-LD, sitemap, robots, llms.txt, Metrika) | ✅ **Complete** (6.8 CWV audit deferred) | Verification IDs at cutover |
| 7 | AMP + Turbo + YML feed | ✅ **Complete** | — |
| 8 | i18n plumbing (RU launch, EN-ready) | ✅ **Complete** | — |
| 9 | Cutover (staging deploy, 301 map, DNS, observability) | ⛔ **Blocked** | Vercel + Fly/Railway + Sentry + DNS + Tilda export |

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

## Phase 0 — Repo Scaffolding & Tooling ✅ Complete

**Shipped:** 9 commits `5eda343…7702cee`. Monorepo skeleton, shared types workspace, Express API on :3001 with `/health`, Next.js 16 + React 19 + Tailwind v4 web app, Prettier + EditorConfig, GitHub Actions matrix (Node 20/22), `.env.example` for both services.

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

## Phase 1 — Shop DB Schema + API CRUD ✅ Complete

**Shipped:** commits `b294127…12e04ca`. Local Postgres (Homebrew `postgresql@16` — see Task 1.1 adaptation below), TypeORM DataSource, 9 entities (Product, ProductImage, ProductCategory, Page, Order, OrderItem, AdminUser, EntityRevision, Redirect) with 2 migrations applied, public + admin REST CRUD for Products/Categories/Pages with zod validation, `{ error }` envelope, soft-delete, slug-conflict handling, pagination, seed script with realistic Russian chemistry-kit data (3 categories, 8 products, 4 pages, 1 admin user).

**Goal:** Local Postgres (via docker-compose), TypeORM entities matching design-doc schema, migrations, and CRUD endpoints (with validation + tests) for products, categories, and pages. Auth deferred to Phase 3.

### Task 1.1: Local Postgres via Homebrew *(adapted — docker not installed)*

**Files:**
- Modify: `ximi4ka-shop/api/.env.example` — point `DATABASE_URL` at the local Homebrew Postgres on `:5432`.

**Setup commands (one-time, already done on dev machine):**
```
brew install postgresql@16
brew services start postgresql@16
createdb ximi4ka_shop
```

**Commit:** `chore: use Homebrew Postgres for local dev` *(commit b294127)*.

> Original plan used `docker-compose.yml` on port 5433. Switched to Homebrew because Docker isn't installed on the dev machine. Homebrew Postgres runs as a user-level service on the default :5432.

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

## Phase 2 — Public Storefront (Catalog, Product, Cart) ✅ Complete

**Shipped:** commits `04eaa24…5974262`. Typed API client in `web/lib/api.ts`, SSG/ISR homepage + category list/detail + product detail + `/[slug]` CMS pages + `/cart` full page, 8-type block renderer with DOMPurify sanitization and FAQ JSON-LD (GEO win), localStorage cart with drawer via custom events, site-wide Header + Footer using brand tokens (`#836efe` etc.), mobile burger, active-route highlight, all strings in Russian. 8 working routes verified via browser smoke tests + screenshots.

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

## Phase 3 — Admin Panel + WYSIWYG ✅ Complete

**Shipped:** commits `73dad05…a14f00e`. Full admin at `/admin` with cookie sessions + CSRF, sidebar navigation, CRUD UIs for every resource, Tiptap rich-text editor, block editor mirroring public `BlockRenderer`, media library, redirects with CSV import and active 301 middleware, revision history with restore, and site settings driving `/robots.txt`, `/llms.txt`, Metrika/GA4 injection, YML feed metadata, Yandex Pay sandbox/production toggle.

**Task-by-task commit map:**

- 3.1 — Admin auth (cookie sessions + CSRF + argon2) → `2ed7702 feat(api): add admin auth with cookie sessions and CSRF`
- 3.2 — Admin shell + login page + sidebar → `309052a feat(web): add admin shell with login and sidebar nav`
- 3.3 — Product management UI → `0eac836 feat(web): admin product management UI`
- 3.4 — Tiptap rich text editor → `b93d6f5 feat(web): add Tiptap rich text editor`
- 3.5 — Block editor + live preview → `1ab863f feat(web): add block editor with 8 block types and preview`
- 3.6 — Category tree editor → `35e6be0 feat(web): admin category tree editor`
- 3.7 — Page management UI → `4acb8f2 feat(web): admin page management UI`
- 3.8 — Media library → `3763eb6 feat(web): admin media library`
- 3.9 — Redirects CRUD + CSV import + active middleware → `9e45c25 feat: admin redirects with CSV import and active middleware`
- 3.10 — Revision history with restore → `6ef5f3b feat: revision history with restore`
- 3.11 — Site settings (robots/llms/analytics/yml/yandex-pay) → `a14f00e feat: add site settings (robots/llms/analytics/yml/yandex-pay)`

**Image storage:** in dev, local disk under `api/uploads/`. In prod, Supabase Storage — adapter interface in API so swap is one env-var change.

**Carry-forward:** The YML settings schema shipped with discrete typed columns (`yml_shop_name`, `yml_company`, `yml_url`, + Yandex Webmaster / Google Search Console verification IDs) rather than one JSONB blob. `currency` and `deliveryNote` fields will be added by Phase 7 when the YML generator has concrete requirements.

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

## Phase 6 — SEO + GEO ✅ Complete (6.8 CWV audit deferred)

**Shipped:** commit `2da1596 feat: add SEO + GEO coverage (generateMetadata, JSON-LD, sitemap, regression tests)`.

- 6.1/6.7 — `buildMetadata` helper in `web/lib/metadata.ts`; `generateMetadata` wired into `/`, `/categories`, `/categories/[slug]`, `/product/[slug]`, `/[slug]`, `/cart`. Respects admin-set `metaTitle`/`metaDescription`/`ogImage`/`canonicalUrl`/`noindex`. OG + Twitter tags included. Cart is `noindex`.
- 6.2 — `web/lib/jsonLd.ts` with Organization, WebSite + SearchAction, BreadcrumbList, Product, ItemList, Article generators. `<JsonLd>` injector component. FAQ `FAQPage` continues to be emitted by the Phase 2.5 block renderer (unchanged).
- 6.3 — `web/app/sitemap.ts` returns `MetadataRoute.Sitemap` with homepage, categories index, cart, every published product, every category, and every published CMS page (via a new `GET /api/public/pages` list endpoint + `listPages` client).
- 6.4 `/robots.txt` — landed in Phase 3.11.
- 6.5 `/llms.txt` — landed in Phase 3.11.
- 6.6 Metrika + GA4 injection — landed in Phase 3.11.
- 6.9 — Regression test suites: 13 tests for `buildMetadata`, 9 for JSON-LD generators, 3 for sitemap, 3 for product-page metadata, 2 each for `/api/public/pages` + `listPages`. +32 tests total (web 333 / api 131 / shared 6).

**Deferred (6.8):** Core Web Vitals audit via Lighthouse CI — flag as follow-up. Needs a hosted staging target to measure against meaningfully.

**Also deferred:** real `og-default.png` asset (currently a placeholder path); `hreflang` alternates (deferred to Phase 8 i18n).

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

## Phase 7 — AMP + Turbo + YML Feed ✅ Complete

**Shipped:** commit `b03cf7a feat: add AMP, Turbo, and YML feeds`.

- 7.1 / 7.3 — `/amp/product/[slug]` and `/amp/article/[slug]` route handlers return AMP-valid HTML via pure string templates in `web/lib/amp.ts`. Canonical pages emit `<link rel="amphtml">` via the extended `buildMetadata` helper.
- 7.2 — `amphtml-validator` runs in unit tests; live smoke test against `/amp/product/:slug` returns PASS.
- 7.4 — `/turbo.xml` route handler emits Yandex Turbo RSS 2.0 with namespaced `<turbo:content>` wrapping product and CMS-page content.
- 7.5 — `/yml.xml` route handler generates Yandex Market Language feed from published products + `SiteSettings`. Category-UUIDs mapped to integer IDs inline. Backed by a new `?include=categories` param on `GET /api/public/products` that returns `categoryIds[]`.
- 7.6 — Admin "Проверить YML" button with structural validation (required elements, offer counts). Real DTD validation is deliberately skipped (Yandex publishes a DTD, not an XSD; full client-side validation is disproportionate).
- 7.7 — Unit tests for all three generators + API tests for the products-with-categories and public-settings-with-YML extensions.

**Migration:** `1777000000000-AddYmlCurrencyAndDelivery` adds `yml_currency` (default `'RUB'`) and `yml_delivery_note` to `site_settings`.

+46 tests (web 377 / api 133 / shared 6 = 516).

---

## Phase 8 — i18n Plumbing ✅ Complete

**Shipped:** commit `dd10c72 feat: i18n plumbing (RU default, EN prefix with RU fallback)`.

- 8.1 — Middleware-driven locale routing. Public routes moved under `web/app/[locale]/(public)/…`. Unprefixed URLs (`/product/foo`) rewrite internally to `/ru/product/foo` so RU stays prefix-free; `/en/product/foo` routes through the same `[locale]` segment. No i18n library — ~50 LoC of helpers in `web/lib/i18n.ts`.
- 8.2 — `translations` JSONB already existed on Product / ProductCategory / Page entities (added in Phase 1.3/1.4). No migration needed. Strict zod validation added via shared `TranslationsSchema` in `api/src/routes/admin/i18n.ts`.
- 8.3 — `web/components/admin/LanguageTabs.tsx` used in Product, Category, and Page admin forms. Tabs: `[RU ✓] [EN ·]`, completeness indicator per tab, save writes RU fields at the top level and EN fields under `translations.en` in a single PATCH.
- 8.4 — `buildMetadata` emits `<link rel="alternate">` for every locale plus `x-default`. Sitemap emits `alternates.languages` per URL.
- 8.5 — Verified `/en/product/:slug` renders RU fallback content when `translations.en` is missing; no broken pages.

**Out of scope (RU-only at launch):** per-locale slug routing; translating static nav, button strings, cart state, or the admin UI itself — these remain RU-only and ready to be translated in a follow-up.

+36 tests (web 410 / api 136 / shared 6 = 552).

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

Phases 0–2 had bite-sized TDD tasks because they were executed first. Phases 3–9 were outlined; each phase gets expanded into bite-sized tasks **before execution**, not all upfront. Phase 3's outline was expanded during execution (see the per-task commit map above).

Phases 4–9 remain as outlines. When the next phase is ready to start, expand its outline into the standard TDD-style step list.

## Current State Snapshot (as of 2026-04-20)

- **Repo:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka-shop/`
- **Branch / HEAD:** `main` @ `dd10c72`
- **Commit count:** 40
- **Tests:** 552 passing (web 410 / api 136 / shared 6), 0 failing
- **Typecheck / lint / build:** all green
- **Local services:** Postgres 16 (Homebrew, `brew services`), api dev `npm run dev -w api` (:3001), web dev `npm run dev -w web` (:3000)
- **Seeded admin:** `admin@ximi4ka.local` / `admin-password-change-me` (hashed, LOCAL DEV ONLY)

## Outstanding Carry-Forwards

- `DeliveryAddress` shape needs Russia-specific fields (`region`, `country`) before Phase 4 Yandex Pay integration.
- Product `og_image` column is varchar(255) while the admin zod schema allows up to 500 chars — small migration to harmonize.
- 6.8 Core Web Vitals audit (Lighthouse CI) — deferred; needs a hosted staging target.
- `og-default.png` is a placeholder URL; real image needed in a design pass.
- Per-locale slug routing — out of scope for Phase 8; EN uses RU slugs.
- Static nav / button / cart / admin-UI strings — out of scope for Phase 8; RU-only for now.
- Root `npm run -ws` deprecation warning — cosmetic; switch to `--workspaces` when convenient.
- `.claude/launch.json` is a local preview-tooling file, untracked.

## External Prerequisites Still Blocking

| Phase | Needed |
|---|---|
| 4 | Yandex Pay merchant account (contract signed, API key + secret, sandbox creds) |
| 5 | Shared-secret env value + ERP deploy access to add `POST /api/internal/orders/inbound` |
| 9 | Vercel + Fly.io (or Railway) + Sentry accounts; DNS for `shop.ximi4ka.ru` + `api.shop.ximi4ka.ru`; Tilda URL export + top-traffic list from Metrika; production Yandex Pay credentials |
