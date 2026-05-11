# Marketing Unit Brainstorm — Session Handoff

**Date:** 2026-05-11
**Status:** Brainstorm in progress, paused at Question 3 (out of ~8 expected)
**Author:** transitional doc between sessions
**Project:** XimOS

---

## 🎯 What is this doc

Mid-brainstorm checkpoint. The previous Claude session was running out of context window during a strategic brainstorm with the user (Vasily) about the next major XimOS unit — **Marketing**. We need to compact the current state so a fresh session can pick up precisely where we stopped.

**The terminal goal of this brainstorm:** complete operating-model design for the Marketing unit + detailed PRD for content production sub-module, both committed to `docs/plans/`, then transition to writing-plans and subagent-driven-development for implementation.

---

## 📍 Where XimOS is right now (state of the system at handoff)

### Recent product evolution

XimFinance → XimERP → **XimOS** rename happened (commit `c36c206`). Tagline: «Операционная система управления бизнесом» (Operational System for Business Management).

### Core operational subsystems that exist

Sidebar layout (`frontend/src/components/Layout.tsx`):

1. **Обзор** — Дашборд
2. **Финансы** — Транзакции, Категории, Контрагенты, Отчёты, Фин. отчёты, БДДС (bank-import: Точка/Озон, auto-categorization rules, manual entry)
3. **Себестоимость** — Компоненты, Расчёт себестоимости, Юнит-экономика, Матрица маржи, Отчёт о продажах
4. **Закупки** — Поставки
5. **Производство** — Заказы на производство, Контроль качества
6. **Планирование** — Направления, Регулярные задачи, Проекты, Канбан-доски, **Контент-банк**, **Войсовер**
7. **Маркетплейсы** — Продажи, Реклама WB, Финансы WB
8. **Настройки** — Сотрудники, Каналы продаж

### Most relevant for marketing unit

#### Content-bank (`/content-bank`) — current content production system

- `ContentUnit` entity in `backend/src/entities/ContentUnit.ts` — single content type schema currently optimized for **short video** scripts:
  - `title`, `hook`, `hook_ab`, `essence`, `notes`, `complexity`, `status`, `rubric_id`
  - **Production block**: `script_text`, `video_brief`, `voiceover_text`, `visual`, `video_url`, `ready_at`
  - **Review block**: `review_grade` (excellent/needs_work/rejected), `review_feedback`, `reviewed_at`
  - **content_type enum**: only `'short_video' | 'text_post' | 'other'` (text_post is placeholder, not built out)
- `ContentRubric` — 6 active rubrics, each with title/emoji/tone/audience/cta_template
- `ContentPublication` — per-network publication record (scheduled_at, published_at, network, published_url, notes, sort_order)
- Filters: status (idea/script/filming/editing/ready/published/rejected), review_grade, complexity, network, rubric_id, search, sort
- Triage view (`/content-bank/triage`) — keyboard-driven review queue (1/2/3 hotkeys)
- Bulk JSON import + export
- **Dashboard view** integrated into `/content-bank` (was previously `/content-engine` — merged):
  - 9-stage Pipeline (ideas / triage_needs_work / excellent / planning / scripting / voiceover_prep / production / published / rejected)
  - Metrics row (4 cards)
  - Bottlenecks warnings
  - Today's queue
  - Recent published
  - 30s auto-refresh, paused when modal open

#### Voiceover Studio (`/voiceover`) — AI content production tool

5-step wizard with iterative learning loop:
1. **Unit picker** — select content_unit
2. **Generate** — Claude generates script using `style_guide_video` + `rubrics_matrix` + etalon
3. **Factcheck** — Claude reviews for accuracy
4. **Style + Iterative Learning** — Claude applies style + extracts pattern addenda from operator edits; addenda go into `brand_docs.style_guide_video` (versioned, cache-invalidated)
5. **Preprocess** — Claude generates ElevenLabs-ready chunks with U+0301 stress marks + emotional tags
- Writeback: Step 4 writes `script_text`, Step 5 writes `voiceover_text`
- Backend `/api/claude/*` endpoints proxy to Anthropic; cost: ~$0.04-0.08 per preprocess, ~$0.26 per full wizard

#### Brand documents

`brand_docs` table (in Supabase) — currently 4 entries:
- `style_guide_video` (~14k chars, v1.5 after iterative learning)
- `rubrics_matrix` (2k chars)
- `style_guide` (3.5k chars, older general version)
- `session_start_prompt`

The **iterative learning loop** is a USP — operator edits a script, Claude extracts patterns, addenda are versioned into `brand_docs`. This is unique in the market.

### Known issues / pending

- **Anthropic API credits depletion** caused recent preprocess failures. User must top up at console.anthropic.com → Billing. Code now correctly maps "credit balance too low" to HTTP 402 + clear Russian toast (commit `8abadf1`). The Max subscription doesn't include API credits — this is a billing model issue, not a code bug.

---

## 🧠 Marketing Unit Brainstorm — progress so far

### User's framing (verbatim)

> «Маркетинговая стратегия» как верхний модус этого юнита, определяющий стэк задач для нижних модусов. Другие модусы: контент-маркетинг, PPC-реклама, PR, SEO,... (?)
>
> Если мы качественно зафиналим маркетинговый юнит, можно будет продвигаться к следующим.

The user pushed back against doing the WHOLE business OS at once. Wants to ship marketing unit completely before moving on.

### Question 1: Scope of THIS brainstorm — ANSWERED

**Choice B selected:** Marketing operating model (light sketch) + detailed PRD on content production.

Reasoning: operating model defines the parent unit (how Marketing Strategy → sub-modules → cross-cutting analytics relate). Content production PRD goes deep on the urgent sub-module.

### Question 2: Content types covered by the content production PRD — ANSWERED

User confirmed «остановимся на нем» = all of the following:

**Video formats:**
- ✅ Short videos (TikTok/Reels/YouTube Shorts, 30-90s) — currently built
- ✅ Long videos (YouTube, 5-15 min) — educational deep dives
- ✅ Streams / live (YouTube/Twitch/VK) — real-time experiments, Q&A
- ✅ Podcast / audio (YouTube/Apple Podcasts) — popsci conversations

**Text formats:**
- ✅ Short post (Telegram, X, VK) — thought + 1-2 facts
- ✅ Long post (Telegram, VK) — mini-article 2-5 screens
- ✅ Carousel (Instagram, sometimes LinkedIn) — 5-10 slides
- ✅ SEO article / blog (site, Дзен) — 1500-5000 words for keywords

**Hybrid / service:**
- ✅ Email newsletter
- ✅ Lead magnet / PDF («Гайд: 10 опытов с детьми», etc.)
- ✅ Marketplace product cards (WB/Ozon — description, infographics) — treated as marketing per user OK
- ✅ Ad creatives (static banners, video ads, headlines) — separate pipeline from organic

**Explicitly OUT of scope of content production PRD:**
- ❌ UGC from clients (community management — separate sub-module)
- ❌ Packaging design (product/operational, not marketing content)

### Question 3: Marketing sub-modules to lock into operating model — PENDING

The next message to user enumerated these candidates. User has not yet answered. The candidates were:

**Top-level:**
- ✅ Marketing strategy — positioning, ICP, JTBD, pricing, yearly goals, budget allocation per channel; defines priorities for tactical modules

**Tactical:**
- ✅ Content-marketing (the one we're PRD-ing)
- ☐ PPC / Paid advertising (WB Реклама existing, Ozon, Яндекс Директ, VK Ads, Google Ads)
- ☐ SEO (organic search Яндекс/Google, keyword research, technical SEO, content for keywords)
- ☐ PR / External comms (Habr, vc.ru, Дзен posts, interviews, events, mentions)
- ☐ CRM / Email marketing (segmentation, retention, welcome series)
- ☐ Influencer marketing (Telegram channels, YouTube, Instagram bloggers; pay per reach/sale)
- ☐ Community management (Telegram chat, social comments, UGC, loyalty)
- ☐ Affiliate / partner marketing (promo codes, ref links, brand cross-promo)
- ☐ Event marketing (offline expos, masterclasses, school fairs)

**Cross-cutting:**
- ☐ Marketing analytics — unified BI: ROAS per channel, attribution, customer journey, LTV/CAC, marketing mix modeling

**Likely cuts for Ximi4ka at this stage:**
- Affiliate (no scale)
- Event marketing (sporadic)
- Influencer as standalone (probably sub-category of PR or content)

---

## 📋 Remaining brainstorm questions (estimated 5-6 more)

After Q3 (which marketing sub-modules), expect to ask in some order:

### About content production PRD specifics

**Q4: Channels per content type** — where each format publishes. Needed to design data model (channels as first-class entity, or just per-publication URL).

**Q5: Team & roles** — who creates content? Sole content-manager + AI? 3-person team with roles (writer / designer / video-editor)? Determines workflow complexity, RBAC needs.

**Q6: Production workflow per content type** — same 5-step pipeline as Voiceover Studio (idea → script → produce → preprocess → publish), or each type has its own pipeline? Most likely hybrid: shared «idea → script» upper steps, format-specific lower steps. Needs to be designed explicitly.

**Q7: Asset storage** — where do drafts/finals live? Currently `video_url` is just a string. Need real strategy: Google Drive integration / S3 / Supabase Storage / external CDN.

**Q8: Integration with channels** — what does «publish» mean? Just record-keeping (URL after manual upload, as today), or proper API integration (auto-post to TikTok Business, YouTube, Telegram channel, Mailchimp)?

### About operating model

**Q9: How does Marketing Strategy module drive tactics?** — manually written goals operators interpret, OR a structured object (yearly budget, OKRs per sub-module, KPI targets) that tactical modules consume programmatically?

**Q10: KPI taxonomy** — what metrics matter per content type? Per channel? Defines what marketing-analytics module aggregates.

**Q11: Marketing analytics scope (cross-cutting)** — first-class module in operating model, or v2 feature? If first-class — depth of integration (per-piece tracking, attribution, etc.).

---

## ✅ When the brainstorm completes, the deliverables are

1. **Operating model design doc** at `docs/plans/2026-05-1X-marketing-unit-operating-model-design.md`
   - 1-page diagram of strategy → 5-6 tactical sub-modules → analytics
   - Cross-module data sharing rules (shared customer DB, budget allocator, analytics layer)
   - Module boundaries (what's content vs. PPC vs. PR — explicit definitions)

2. **Content production PRD** at `docs/plans/2026-05-1X-content-production-prd-design.md`
   - All 12 content types with shared and type-specific fields
   - Workflow per type (or shared with branching)
   - Data model evolution from current `ContentUnit` (probably: rename to generic + content_type discriminator, or polymorphic subtypes)
   - Channel integrations (which APIs, which manual)
   - AI-assist patterns per type (which use Claude / how)
   - Roles & RBAC implications
   - Migration plan from existing content-bank (don't break the working short-video pipeline)

3. **Implementation plan** — output of `writing-plans` skill, multi-stage bite-sized tasks.

4. **Execution** — subagent-driven-development (project convention).

---

## 🚦 How a fresh session should resume

1. Read this doc top-to-bottom.
2. Greet the user briefly: «Перечитал handoff. Готов продолжить с Вопроса 3 — какие модусы маркетинга закладываем».
3. Ask Question 3 from the «Q3 PENDING» section above. The full list of candidates is in this doc — re-present it inline so user doesn't need to scroll.
4. Continue one question at a time per `superpowers:brainstorming` discipline.
5. When all questions answered, write the two design docs and commit each.
6. Invoke `superpowers:writing-plans` for implementation plan.
7. Then `superpowers:subagent-driven-development` for execution.

---

## 💡 Important context the next agent should know

- **Two-remote deploy:** `origin` (Railway backend) + `vercel-deploy` (Vercel frontend). Always push both.
- **Project convention is work-on-main directly** (user has confirmed this many times throughout 2026 — no worktrees needed for routine work).
- **Anthropic billing** — user paid $200/mo Max subscription but Anthropic doesn't include API credits in Max. User needs to top up API at console.anthropic.com → Billing separately. Recent error mappings in `handleClaudeError` show this clearly now.
- **Brand_docs** are the source of truth for AI prompts (style_guide_video evolves with each iteration of Voiceover Studio learning loop). Marketing unit will likely need additional brand_docs (style_guide_text, style_guide_carousel, style_guide_email — TBD in PRD).
- **Existing Voiceover Studio is the prototype for AI-augmented content production** — new types should follow the same operating model: generate → factcheck → style → preprocess → publish, with iterative learning where applicable.

---

## 📦 Working files / locations

- This doc: `docs/plans/2026-05-11-marketing-unit-brainstorm-handoff.md`
- Past design docs in same folder (for reference): `2026-05-07-content-bank-design.md`, `2026-05-08-content-bank-v2-design.md`, `2026-05-10-voiceover-studio-design.md`, `2026-05-10-iterative-script-learning-design.md`, `2026-05-10-content-bank-engine-merge-design.md`
- Project root: `/Users/vasilijaistov/Desktop/continuum/ximi4ka`
- Layout / sidebar: `frontend/src/components/Layout.tsx`
- Content unit entity: `backend/src/entities/ContentUnit.ts`
