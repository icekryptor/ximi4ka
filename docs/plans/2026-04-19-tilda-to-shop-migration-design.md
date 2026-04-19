# Tilda → Self-Hosted Storefront Migration — Design

**Date:** 2026-04-19
**Status:** Design approved, ready for implementation plan
**Related:** follow-up doc — `2026-04-19-tilda-to-shop-migration-plan.md` (to be produced via writing-plans skill)

## Goal

Migrate Ximi4ka's public e-commerce website from Tilda to a self-hosted storefront. The new system must preserve SEO, support online payments (Yandex Pay priority), be editable by non-technical staff via an admin panel, and integrate with the existing XimERP for order handling.

## Decisions Locked In

1. **Site type:** Full e-commerce storefront (catalog, cart, checkout, payments).
2. **Codebase location:** New separate repo `ximi4ka-shop`, with its own backend. Integrates with the existing ERP repo via a single inbound-orders endpoint.
3. **Data ownership:** Storefront owns the catalog (products, categories, descriptions, images, landing pages). ERP receives paid-order notifications and forwards them to the existing Telegram bot.
4. **Payments:** Online payments integrated. **Yandex Pay is the priority method.** Card fallback via the same or secondary gateway.
5. **Content editing:** Admin panel inside the storefront backend with WYSIWYG block editor (Tiptap) for product descriptions and landing pages. Non-technical staff edit without engineering.
6. **Cutover:** Soft cutover. Launch new site on `shop.ximi4ka.ru` while Tilda keeps running on `ximi4ka.ru`. Swap DNS after parallel run; add 301 redirect map from old Tilda URLs.
7. **Tech stack:** Next.js 15 (App Router) for the storefront + admin, Node + Express + TypeORM + Postgres for the API. Matches the existing ERP's backend stack for team familiarity while gaining SSR/SSG for e-commerce SEO.

## Architecture

### Repos & services

New repo `ximi4ka-shop` (sibling to `ximi4ka` ERP repo). Monorepo layout:

```
ximi4ka-shop/
  web/      — Next.js 15 App Router. Public storefront + /admin panel.
  api/      — Node + Express + TypeORM. Shop Postgres DB on Supabase.
  shared/   — shared types (Order DTO, Product type, etc.)
```

Three deployment targets:

1. `shop.ximi4ka.ru` — Next.js storefront + admin, deployed on Vercel (SSR + edge caching).
2. `api.shop.ximi4ka.ru` — Express API + admin CRUD, deployed on Fly.io or Railway (long-lived Node server, handles payment webhooks reliably).
3. Existing ERP — gains one new endpoint `POST /api/internal/orders/inbound` that receives paid-order notifications from the shop API and forwards them to the existing Telegram bot.

Separate Supabase project for the shop DB. The ERP inbound-orders endpoint is the only coupling point.

### Why Express for the API layer (not Next.js route handlers)

- Payment webhook reliability — Yandex Pay retries on 5xx; a long-lived Node process handles this more reliably than serverless functions that cold-start.
- Background jobs — reconciliation polling, ERP sync retries, email receipts, feed regeneration — easier on a persistent Node server.
- Admin CRUD is many endpoints; keeping them out of Next.js route handlers keeps the Next app focused on rendering.

## Data Model (shop database)

Separate Postgres on Supabase. All IDs UUID.

- **`products`** — `id`, `slug`, `sku`, `name`, `short_description`, `price_rub`, `compare_at_price_rub`, `stock_status` (`in_stock` / `out_of_stock` / `preorder`), `is_published`, `sort_order`, `long_description_blocks` (JSONB), SEO fields (see below), `translations` JSONB, `created_at`, `updated_at`, `deleted_at`.
- **`product_images`** — `id`, `product_id`, `url`, `alt`, `sort_order`.
- **`product_categories`** + **`product_category_links`** (many-to-many). Category has `slug`, `name`, `parent_id`, SEO fields, `translations`.
- **`pages`** — marketing pages (home, about, delivery, contacts, custom landings). `id`, `slug`, `title`, `blocks` (JSONB), SEO fields, `translations`, `is_published`.
- **`orders`** — `id`, `order_number` (human-readable `XM-YYYY-NNNNN`), `status` (`pending` / `paid` / `failed` / `cancelled`), `customer_name`, `customer_phone`, `customer_email`, `delivery_address` (JSONB), `delivery_method`, `subtotal_rub`, `shipping_rub`, `total_rub`, `payment_provider` (enum: `yandex_pay`, ...), `payment_intent_id`, `created_at`, `paid_at`, `erp_synced_at`.
- **`order_items`** — `id`, `order_id`, `product_id`, `product_snapshot` (JSONB: name/price/sku at purchase time), `quantity`, `unit_price_rub`.
- **`admin_users`** — `id`, `email`, `password_hash` (argon2), `role` (`editor` / `admin`), `created_at`.
- **`entity_revisions`** — `entity_type`, `entity_id`, `snapshot` (JSONB), `edited_by`, `edited_at`. Supports "Restore previous version" in admin.
- **`redirects`** — `from_path`, `to_path`, `status_code` (default 301), `hit_count`.

Design notes:

- **`product_snapshot` on order items** — freezes product data at order time; historical orders remain correct after product edits.
- **No `cart` table** — cart lives in client `localStorage` until checkout creates a `pending` order.
- **Soft deletes** for products, pages, and orders (`deleted_at`). Orders are effectively append-only in status (no destructive deletes).

## Order Lifecycle & ERP Integration

1. **Browse & cart (client only)** — SSR/SSG product pages; cart in `localStorage`; no account required.
2. **Checkout submitted** — `POST /api/checkout` with `{ items, customer, delivery }`. API validates stock, recomputes totals server-side (client price never trusted), creates `orders` (status `pending`) and `order_items` with `product_snapshot`. Calls Yandex Pay to create a payment and responds with `{ order_number, payment_url }`. Idempotency on client-provided `idempotency_key` header.
3. **User pays at Yandex Pay** → redirected to `/order/{number}/pending`. Client polls `GET /api/orders/{number}/status`.
4. **Yandex Pay webhook arrives** (the real source of truth) — `POST /api/webhooks/yandex-pay`. Verify signature. Idempotent on `payment_intent_id`. On `payment.succeeded`: set `status = 'paid'`, `paid_at`, enqueue ERP-sync job, return 200 fast.
5. **ERP sync job** — `POST https://erp.ximi4ka.ru/api/internal/orders/inbound` with shared-secret auth header and full order DTO. On success, set `erp_synced_at`. On failure, retry with exponential backoff (1m, 5m, 30m, 2h, 12h). After exhausting retries, fallback direct-to-Telegram alert from shop side so orders never go dark.
6. **ERP handles order** — new endpoint stores the record and forwards a formatted message to the existing Telegram bot. Idempotent on `order_number`.
7. **Customer sees "paid" state** — status polling picks up the transition; success page renders.

Resilience:

- Webhook is the trigger, not the redirect. Users closing tabs or losing network does not lose orders.
- **Reconciliation job** (every 5 min): queries Yandex Pay's status API for any `pending` orders older than 2 minutes; upgrades them accordingly. Covers "webhook missed" edge cases.
- ERP downtime never blocks payment confirmation to the customer — sync is async and retried.
- Everything idempotent on `payment_intent_id` / `order_number` / client `idempotency_key`.

## Admin Panel

Route: `shop.ximi4ka.ru/admin`. Cookie-session auth (argon2 + HTTP-only cookie + CSRF token on mutations). Russian UI.

Sections: **Products**, **Categories**, **Pages**, **Orders** (read-mostly, with "Resync to ERP" manual retry), **Redirects**, **Media library**, **SEO settings**.

WYSIWYG editor (Tiptap-based). Block types:

- `paragraph` — rich text with bold/italic/lists/headings/links.
- `image` — drag-drop upload to Supabase Storage; alt required; sizing.
- `gallery` — multi-image grid.
- `layout` — text + image composite (left/right/top/bottom variants). Addresses existing admin-editor feedback.
- `cta` — heading + subtext + button with link.
- `video` — YouTube / VK / Rutube embed.
- `faq` — expandable Q&A list (renders with `FAQPage` JSON-LD — GEO win).
- `product_grid` — embed selected products by slug, for featured-in-article on landings.

Blocks stored as JSONB (`products.long_description_blocks`, `pages.blocks`). A `<BlockRenderer />` on the public side maps each block type to the same React component the admin's live preview uses — WYSIWYG output ≡ storefront output.

**Revision history** — every edit creates an `entity_revisions` row; admin UI has "Restore previous version" per entity.

## SEO & GEO

Per-entity SEO fields (Products, Categories, Pages):

- `meta_title` (fallback: `name` / `title`)
- `meta_description`
- `og_title`, `og_description`, `og_image`
- `canonical_url` override
- `noindex` flag
- `robots_directives`
- `schema_type` (drives JSON-LD)

Image SEO: every image requires `alt` on publish; filenames slugified on upload; `next/image` with WebP/AVIF + responsive `srcset`.

Structured data (JSON-LD, auto-emitted by page type):

- `Product` (with `offers`, `aggregateRating`, `brand`, `sku`, `availability`, `price`)
- `ItemList` (category pages)
- `Article` + `BreadcrumbList` (landings/articles)
- `Organization` + `WebSite` + `SearchAction` (homepage)
- `FAQPage` (FAQ blocks)

Site-wide plumbing:

- `sitemap.xml` — auto-generated, split if >50k URLs.
- `robots.txt` — admin-editable.
- Yandex Webmaster + Google Search Console verification — configurable in admin settings.
- Яндекс.Метрика + GA4 IDs — configurable in admin settings.
- Enforced single `<h1>` per page; semantic heading hierarchy in block templates.
- URL slugs with live Cyrillic → kebab-case transliteration and uniqueness validation.

GEO (generative engine optimization):

- SSR/SSG (Next.js default) — LLM crawlers do not execute JS well.
- FAQ blocks produce `FAQPage` JSON-LD — highly quotable by LLMs.
- `llms.txt` at root — admin-editable.
- Structured `specs` key/value list per product — rendered as semantic `<table>` + emitted in JSON-LD.
- Author/organization attribution via `Author` / `Publisher` in JSON-LD.
- Fast Core Web Vitals (SSR + `next/image` + minimal JS on catalog pages).

### Internationalization (i18n + hreflang)

- Next.js App Router locale routing: `/ru/...`, `/en/...`, etc. Default locale `ru`.
- Per-entity `translations` JSONB (`{ [locale]: { name, slugs, descriptions, SEO fields, blocks } }`).
- Admin UI: language tabs on every editable entity with translation-completeness indicator.
- Separate slug per language (not locale-prefixed).
- `<link rel="alternate" hreflang="..." />` auto-emitted in `<head>` including `x-default`.
- `sitemap.xml` includes `<xhtml:link rel="alternate" hreflang="..."/>` per URL.
- **Launch scope: RU only.** i18n plumbing is in place; adding EN (or KZ/BY) later is data-only, not a rewrite.

### AMP + Yandex Turbo

- AMP variants for product pages and articles (`<link rel="amphtml">` on canonical HTML).
- Implementation via parallel `/amp/**` routes rendering AMP-valid templates.
- AMP validator runs in CI.
- Turbo-pages RSS generated from the same source content (different output format). Both AMP and Turbo from one content source.

### YML feed (Yandex Market Language)

- Endpoint `GET /yml.xml` — dynamically generated from published products.
- Includes `<offer>` per product with `id`, `url`, `price`, `oldprice`, `currencyId`, `categoryId`, `picture[]`, `name`, `vendor`, `description`, `available`, plus `param` for specs.
- Admin settings page for feed metadata (shop name, company, URL, currencies, delivery).
- Regeneration: on admin product-save (cache invalidation) + nightly safety rebuild. Never generated per-request.
- "Preview YML" admin button validates against Yandex's XSD.

## Error Handling & Resilience (summary)

- **Payment reconciliation job** every 5 min for `pending > 2min` orders — covers missed webhooks and browser-crash cases.
- **Webhook signature verification** mandatory; body never trusted.
- **Idempotency** on `payment_intent_id`, `order_number`, client-supplied `idempotency_key`.
- **Server-side price/stock recomputation** at checkout; client price never trusted; out-of-stock returns 409 with item-level detail.
- **ERP sync retry ladder** 1m → 5m → 30m → 2h → 12h; fallback direct-to-Telegram from shop side after exhaustion.
- **Image uploads** land in Supabase Storage before the editor saves the reference; storage outage surfaces a clear error.
- **Admin damage mitigation** — revision history + soft deletes + separate hard-delete action with confirmation.
- **Public-site degradation** — ISR serves last-known-good product pages when API is down; 404s tracked in Metrika for redirect-gap detection.
- **Observability** — `/health` endpoints; JSON structured logs with propagated request IDs; Sentry on both services; uptime checks on domains + YML feed; error-budget alerts to Telegram.

## Testing Strategy

Scaled to risk: heavy on order flow, light on admin UI.

- **Unit tests (Vitest)** — price/total computation, stock checks, slug generation, YML feed XML generator, JSON-LD generators, block-renderer mapping.
- **Integration tests (api)** — full checkout with mocked Yandex Pay (create → webhook → paid → ERP sync); webhook signature valid/invalid/replay; reconciliation job; ERP sync retry + fallback Telegram; idempotency.
- **E2E tests (Playwright)** — browse → cart → checkout → pay (Yandex Pay sandbox) → success page; admin login → create product → publish → storefront shows it; 301 redirect old → new.
- **SEO regression suite** on every `main` push — snapshot assertions on `title` / meta / `og:*` / canonical / JSON-LD presence + validity; AMP validator on `/amp/**`; YML XSD validation on `/yml.xml`; sitemap well-formed + expected URL count.
- **Manual QA before cutover** — one real ₽1 Yandex Pay purchase + refund in production mode; end-to-end Telegram delivery via ERP sync path; 301 map covers top-20 Tilda URLs; Yandex Webmaster + Search Console verified; Core Web Vitals pass on mobile for homepage + product + category.
- **Explicitly not tested** — admin UI beyond login + product-create smoke; visual regression; load tests.

## Cutover Plan

1. Launch new site on `shop.ximi4ka.ru`; Tilda continues on `ximi4ka.ru`.
2. Parallel run — monitor Metrika on both, collect Tilda URL inventory with traffic ranks.
3. Bulk-import `redirects` table from CSV mapping top Tilda URLs → new equivalents.
4. Swap DNS: new storefront → apex `ximi4ka.ru`; `shop.` becomes alias.
5. Post-launch: audit Yandex Webmaster + Search Console for 404s; add mappings for any that appear.

## External Prerequisites (owner action required before implementation)

1. Yandex Pay merchant account — contract signed, API key + secret available.
2. New Supabase project provisioned for the shop DB.
3. New GitHub repo `ximi4ka-shop` created.
4. Domain/DNS control for `shop.ximi4ka.ru` + `api.shop.ximi4ka.ru`.
5. Yandex Webmaster, Яндекс.Метрика, Google Search Console, GA4 — verification IDs.
6. Tilda URL export + top-traffic page list from Metrika (raw material for 301 map).
7. Accounts/credentials for Sentry, Vercel, and chosen Node host (Fly.io or Railway).
8. Shared-secret value for the ERP `orders/inbound` endpoint (set on both sides as env var).

## Non-Goals (v1)

- Product reviews / ratings feature.
- Multi-language content (plumbing only — EN content is post-launch).
- Discount codes, gift cards, B2B pricing tiers, product variants (size/color) — add later if needed.
- Visual regression testing.
- Load testing.

## Next Step

Transition to the `writing-plans` skill to produce a phased implementation plan (`2026-04-19-tilda-to-shop-migration-plan.md`) with concrete, reviewable steps and per-phase checkpoints.
