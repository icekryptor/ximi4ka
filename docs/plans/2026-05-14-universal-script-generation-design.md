# Universal Script Generation via Brand-Doc Trigger — Design

**Date:** 2026-05-14
**Scope:** Replace the carousel-only `script-prompt-builder` with a universal «🪄 Сгенерить» button that works on **any** content type by emitting a short trigger-phrase prompt that references brand-docs by slug (read via Supabase MCP), instead of inlining the strategy/guideline/rubric content.

## Goal

Yesterday's carousel feature inlined a ~10 KB prompt assembled from `strategy_current` + `style_guide_carousel` + rubric tone + unit draft. That works for one content type but doesn't scale: every content type would need its own assembly logic, the prompt repeatedly ships 20 KB of strategy to Claude, and there's no clean place for per-network style or per-format requirements.

Meanwhile, the user already designed and deployed (in brand_docs) a complete **agent-scriptwriter** workflow that:
- Reads brand_docs via Supabase MCP — no inline embedding
- Covers ALL content types via per-format-type field mapping (reels / video / short / carousel / story / post / longread)
- Has CREATE vs AUDIT modes auto-detected by presence of existing fields
- Writes results back to DB with snapshot/rollback via `content_units_history` + `snapshot_content_unit()`
- Has feedback loop: «разбор правок → обновить brand_docs» updates style guides from author edits

Our UI button should **trigger this existing workflow**, not duplicate it. The button copies a short trigger phrase pointing the agent at the right brand-docs for this unit's content_type + network — and the agent does the rest.

## Non-goals (YAGNI)

- No new feedback/audit UI button. Round-trip refinement happens in Claude chat (operator types «разбери правки в юните X»). Already supported by `agent_scriptwriter_prompt` v1.3.
- No markdown preview in the brand-doc editor — operator can preview in Claude.
- No version-history UI for brand_docs. `BrandDoc.version` exists in schema; surface later if needed.
- No drag-to-reorder or search across docs. 9 docs is small.
- No per-network audience docs. The strategy doc + `icp_segment` table + `channel_segment_priority` view already encode this relationally; per-network audience docs would duplicate.
- No new funnel-level column on `content_units`. Strategy doc §2 has the `network → funnel-stage` mapping; agent reads it.

## Architecture

### Three coordinated changes

```
┌─ 1. Brand-doc taxonomy ─────┐
│  9 new slugs in brand_docs  │
│  (style + format groups)    │
│  Seeded as empty stubs.     │
└─────────────┬───────────────┘
              │ referenced by
              ▼
┌─ 2. UI cards on /marketing-strategy ─┐
│  Grid of clickable cards per slug.   │
│  Click → modal with markdown editor. │
│  Existing brandDocsApi.upsert.       │
└──────────────────────────────────────┘
              │
              │ same docs
              ▼
┌─ 3. Universal «🪄 Сгенерить» button ─┐
│  In UnitEditModal, Production tab.   │
│  Frontend builds short trigger:      │
│    «Запусти сценариста для           │
│     юнита {id}. Контекст: stratg,   │
│     style_{cluster}, format_{type}…» │
│  Copy → open claude.ai/new.          │
│  Backend NOT involved.               │
└──────────────────────────────────────┘
```

### 1. Brand-doc taxonomy

**9 new slugs** (added alongside existing — no renames, no breakage of `agent_scriptwriter_prompt` references):

**Style per network cluster (3):**
- `style_instagram` — Reels + Stories + Posts + Carousels for IG
- `style_tiktok_youtube` — TikTok + YT Shorts + YT long
- `style_telegram` — TG long-form, warm-audience content

**Format requirements (6):**
- `format_short_video` — viral hooks, humor, 30–35s
- `format_long_video` — retention structure, hooks, multi-act
- `format_carousel` — slides, hook + утилитарность + subscribe-CTA
- `format_post` — TG/VK short post
- `format_longread` — TG longread, articles
- `format_seo_article` — SEO for Дзен + ximi4ka.ru

**Existing — kept as-is:**
- `strategy_current` (21 KB north star, contains funnel/phase/segments/networks)
- `rubrics_matrix` (17 rubrics)
- `kit_*` (per-SKU knowledge)
- `agent_scriptwriter_prompt`, `agent_scriptwriter_api`, `session_start_prompt`
- Legacy `style_guide_video`, `style_guide_text`, `style_guide`, `style_guide_carousel` (referenced by agent prompt; not removed)

**Seeding.** SQL migration upserts the 9 new slugs with empty `content` and meaningful `title` (e.g. «Стиль: Instagram», «Формат: Короткое видео»). Operator fills content via UI Section 2. Idempotent — re-running the migration doesn't overwrite content.

**No new tables.** Continue using `brand_docs` slug+title+content+version. The taxonomy is naming convention, not schema.

### 2. UI cards on /marketing-strategy

New section between `ThemesSection` and `BudgetsSection`: **«Гайдлайны и форматы»**.

Layout: 2 sub-headers («🎨 Стиль по сетям» — 3 cards, «📐 Требования по форматам» — 6 cards). Cards are auto-laid in 3-column grid (`grid-cols-1 md:grid-cols-3`).

**Card visual:**
```
┌────────────────────┐
│ 📷 Instagram       │
│ Стиль для IG       │
│ 12 KB · 09.05      │
│        [Открыть →] │
└────────────────────┘
```

Empty stub:
```
┌────────────────────┐
│ 🎞️ Короткое видео  │
│ Требования         │
│ 0 KB · пусто       │
│      [Заполнить →] │
└────────────────────┘
```

Card click (anywhere on card) → opens `BrandDocEditorModal`:
- `createPortal` modal, same pattern as `UnitEditModal`
- Header: doc title + close button
- Body: `<textarea>` with markdown, `font-mono text-sm` (same style as `StrategyDocSection`)
- Footer: «Сохранить» button → `brandDocsApi.upsert(slug, {title, content})` → close modal, refresh cards
- Escape closes when not saving

**File structure:**
- `frontend/src/components/marketing/BrandDocCardsSection.tsx` — new section, renders cards
- `frontend/src/components/marketing/BrandDocEditorModal.tsx` — new modal, generic doc editor
- Both colocated in existing `marketing/` folder.

**Hard-coded card list** in `BrandDocCardsSection.tsx`:
```ts
const STYLE_CARDS = [
  { slug: 'style_instagram', icon: '📷', title: 'Instagram', subtitle: 'Стиль для IG' },
  { slug: 'style_tiktok_youtube', icon: '🎬', title: 'TikTok + YouTube', subtitle: 'Стиль для TT/YT' },
  { slug: 'style_telegram', icon: '💬', title: 'Telegram', subtitle: 'Стиль для TG' },
]
const FORMAT_CARDS = [
  { slug: 'format_short_video', icon: '🎞️', title: 'Короткое видео', subtitle: 'Reels / Shorts / TikTok' },
  { slug: 'format_long_video', icon: '🎥', title: 'Длинное видео', subtitle: 'YT long' },
  { slug: 'format_carousel', icon: '🖼️', title: 'Карусель', subtitle: 'Слайды + caption' },
  { slug: 'format_post', icon: '📝', title: 'Пост', subtitle: 'TG / VK короткие' },
  { slug: 'format_longread', icon: '📄', title: 'Лонгрид', subtitle: 'TG longread' },
  { slug: 'format_seo_article', icon: '🔎', title: 'SEO статья', subtitle: 'Дзен / сайт' },
]
```

Size + date fetched via `brandDocsApi.getAll()` on mount; cards display `(content?.length / 1024).toFixed(1) + ' KB'` and a localized short date.

### 3. Universal «🪄 Сгенерить» button

**Location.** In `UnitEditModal`, on the «Производство» tab. Visible for **all** content types. Replaces the current `handleWriteScript` button (which lives on the «Идея» tab over the carousel caption).

**Button label:** «🪄 Сгенерить сценарий» (`Sparkles` from lucide).

**Disabled states (same logic as before):**
- `unit === 'new' && !unitInternal` (not saved yet) → tooltip «Сначала сохрани юнит»
- `saving` → tooltip «Дождись завершения сохранения»
- `generating` (during clipboard/open) → label changes to «Готовлю промпт…»

**On click:**
1. Resolve persisted unit id (`unitInternal?.id ?? unit.id`).
2. Build trigger phrase on frontend (no backend call):
   ```
   Запусти сценариста для юнита {unitId}.

   Контекст (читай через Supabase MCP, project jubkezbvccwvujregkfq):
   - Стратегия: brand_docs.strategy_current
   - Рубрики: brand_docs.rubrics_matrix
   - Стиль по кластеру сетей: brand_docs.{styleSlug}
   - Формат: brand_docs.{formatSlug}
   - ICP: icp_segment (id = u.target_segment_id) + channel_segment_priority
   - SKU (если рубрика product_himichka или явно упомянут SKU):
     kits + kit_unique_features + kit_reviews_curated + kit_use_cases +
     brand_docs.kit_himichka / kit_mini_himichka / kit_electrohimichka
   - Эталон рубрики:
     SELECT script FROM content_units
     WHERE rubric_id = u.rubric_id AND notes ILIKE '%ЭТАЛОН%' LIMIT 1

   Действуй по agent_scriptwriter_prompt §0.5 (определи режим CREATE vs AUDIT по
   наличию script_text/voiceover_text), §1 (выбор артефактов по format_type),
   §2 (применение правил). Перед UPDATE — snapshot_content_unit().
   ```
   `{styleSlug}`, `{formatSlug}` resolved via mappings below.
3. `navigator.clipboard.writeText(trigger)` with execCommand fallback (same defensive pattern as current code).
4. `window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer')`.
5. Toasts: success / clipboard-failed / popup-blocked.

**Style-cluster mapping** (based on publication networks):
```ts
function styleClusterSlugs(unit: ContentUnit): string[] {
  const networks = new Set(unit.publications.map(p => p.network))
  const slugs: string[] = []
  if (networks.has('instagram')) slugs.push('style_instagram')
  if (networks.has('telegram')) slugs.push('style_telegram')
  if (networks.has('tiktok') || networks.has('youtube') || networks.has('youtube_shorts')) {
    slugs.push('style_tiktok_youtube')
  }
  if (slugs.length === 0) slugs.push('style_tiktok_youtube')  // default for unscheduled units
  return slugs
}
```
When multiple publications cross clusters, both slugs are listed. Agent picks the relevant one per publication.

**Format mapping** (content_type → slug):
```ts
const FORMAT_SLUG: Record<ContentType, string> = {
  short_video: 'format_short_video',
  long_video: 'format_long_video',
  carousel: 'format_carousel',
  short_post: 'format_post',
  long_post: 'format_longread',
  seo_article: 'format_seo_article',
  // stub / legacy — point at the closest existing format doc
  stream: 'format_long_video',
  podcast: 'format_long_video',
  email_newsletter: 'format_longread',
  lead_magnet_pdf: 'format_longread',
  marketplace_card: 'format_post',
  ad_creative: 'format_post',
  text_post: 'format_post',
  other: 'format_post',
}
```

### Removal of yesterday's carousel-specific code

**Delete:**
- `backend/src/services/script-prompt-builder.ts`
- `scriptPrompt` method in `backend/src/controllers/content-unit.controller.ts` + the import
- `router.post('/:id/script-prompt', ...)` in `backend/src/routes/content-unit.routes.ts`
- `unitsApi.scriptPrompt()` in `frontend/src/api/contentBank.ts`
- `handleWriteScript` async fn in `frontend/src/components/content-bank/UnitEditModal.tsx`
- The current «🪄 Написать сценарий» button on the carousel-caption block (the button is replaced by the universal one on Production tab)
- The `silent` mode of `handleSave` (was added only to support `handleWriteScript`)
- `axios.isAxiosError` import added for the same reason (only if not used elsewhere)

**Keep:**
- `body_caption` + `slides[]` columns and form-side editing (this is genuine new data model; agent will use these fields as draft for CREATE/AUDIT)
- The empty `style_guide_carousel` BrandDoc — legacy stub, ignored going forward. Future cleanup PR can delete.

**Why remove entirely vs deprecate:** The old prompt builder embeds 30+ KB of brand-doc content inline every click. The new approach is 800-character trigger. Keeping both confuses future readers and the parallel approach is strictly inferior.

## Data flow end-to-end

```
Operator
  └─→ UnitEditModal (Production tab) — clicks «🪄 Сгенерить»
        └─→ Frontend assembles 800-char trigger with style/format slugs
              └─→ Trigger to clipboard, claude.ai/new opens
                    └─→ Operator pastes in Claude
                          └─→ Claude reads brand_docs via Supabase MCP:
                                · strategy_current
                                · rubrics_matrix
                                · style_{cluster}
                                · format_{type}
                                · icp_segment + channel_segment_priority
                                · kit_* (if SKU rubric)
                                · etalon (rubric reference script)
                          └─→ Claude generates draft per agent_scriptwriter_prompt
                                · CREATE: writes to content_units.{script_text|voiceover_text|video_brief}
                                · AUDIT: snapshot_content_unit() → improves
                          └─→ Result auto-persisted in DB via Supabase MCP
                                └─→ Operator refreshes UnitEditModal (or polling later phase) → sees output
                                      └─→ Operator edits inline → saves via PUT /content-units/:id
                                            └─→ Operator can trigger AUDIT in Claude: «разбери правки в юните X»
                                                  └─→ Claude updates style_{cluster} / format_{type} BrandDoc based on diff
```

## Error handling

| Layer | Failure | Behavior |
|---|---|---|
| Migration seed | slug already exists | UPSERT — no-op, content preserved |
| Card list | `brandDocsApi.getAll()` fails | Section shows empty state «Не удалось загрузить» + retry button |
| Card editor | `upsert` fails | Toast error, modal stays open with unsaved content |
| Generate button | Unit not persisted | Toast «Сначала сохрани юнит», button disabled visually |
| Generate button | Clipboard write rejected (native + execCommand) | Toast error «Не удалось скопировать», don't open Claude |
| Generate button | `window.open` blocked | Toast info «Промпт в буфере. Открой claude.ai и вставь» |

## Testing

**Smoke checklist (manual, on prod):**

1. **Migration.** All 9 slugs exist in `brand_docs` with non-empty titles. Existing `strategy_current` etc unchanged.
2. **/marketing-strategy renders.** Section «Гайдлайны и форматы» visible, 9 cards laid out 3×1 + 3×2.
3. **Card sizes accurate.** Filled docs show `12 KB · DD.MM`, empty stubs show `0 KB · пусто`.
4. **Editor modal.** Click `format_carousel` card → modal opens with title «Формат: Карусель» and empty textarea. Type content, save → toast «Сохранено», modal closes, card now shows fresh size + today's date.
5. **Cancel modal.** Click outside modal or Esc → closes without saving. Re-open shows previous content.
6. **Universal button — short_video.** Open a `short_video` unit with publications on TT + YT. Production tab → click «🪄 Сгенерить». Clipboard contains trigger with `style_tiktok_youtube` and `format_short_video`. claude.ai opens.
7. **Universal button — carousel.** Open a `carousel` unit with publications on IG. Trigger contains `style_instagram` + `format_carousel`. Slides + caption included from form state (because handleSave runs before — same silent-save approach reused).
8. **Universal button — long_post.** Trigger contains `style_telegram` + `format_longread`.
9. **Universal button — no publications.** Trigger falls back to `style_tiktok_youtube` (per code).
10. **Disabled state on new unit.** Save button disabled before first persist; «Сгенерить» disabled with tooltip.
11. **Carousel caption block.** «🪄 Написать сценарий» button is gone from the Идея tab.
12. **Old backend endpoint.** `POST /api/content-units/:id/script-prompt` returns 404 (route removed).
13. **No regressions.** Footer Save button on existing units saves normally with success toast.

**Automated tests:** none (project has no test runner; consistent with prior decisions).

## Migration / rollback considerations

- The deletion of `script-prompt-builder` and endpoint is **forward-only** — if rollback needed, revert the deletion commit.
- The 9 new BrandDoc rows are **additive** — rollback leaves them in DB harmlessly (or can be cleaned with one DELETE statement).
- No data is destroyed: `body_caption`, `slides[]`, all existing rows untouched.

## Open questions / future phases

- **Phase 2 (Round-trip UI):** add a «🔁 Дать на разбор правок» button next to «Сгенерить» that emits a different trigger asking the agent to compare current text vs latest snapshot and update style/format docs. Skipped per user — feedback work happens in Claude chat now.
- **Phase 3 (Polish):** auto-refresh unit modal when agent writes to DB, real-time indicator «Агент работает». Requires WebSocket or polling. Not needed for MVP.
- **Phase 4 (Markdown preview):** if operator complains about typing markdown blind, add side-by-side preview to `BrandDocEditorModal`. Easy 1-day addition.
- **Phase 5 (Stub format-docs for unused types):** podcast, stream, ad_creative, etc. — add when those types actually get production runs.
