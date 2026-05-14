# Universal Script Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace yesterday's carousel-only inline-prompt builder with a universal «🪄 Сгенерить» button on the Production tab that emits a short trigger phrase referencing brand-docs by slug, and add a UI surface on `/marketing-strategy` for editing 9 new brand-docs (style + format).

**Architecture:** Three coordinated changes — (1) SQL seed of 9 new `brand_docs` slugs, (2) two new React components (`BrandDocCardsSection`, `BrandDocEditorModal`) on the marketing-strategy page, (3) refactor of `UnitEditModal` to replace `handleWriteScript`/carousel-button with a universal `handleGenerate` that lives on the Production tab. Backend deletion of the now-obsolete `script-prompt-builder` service and POST endpoint.

**Tech Stack:** SQL migration on Supabase, React + TS + Tailwind frontend, lucide-react icons, `navigator.clipboard` + `window.open` for Claude.ai integration.

**Design reference:** `docs/plans/2026-05-14-universal-script-generation-design.md`

**Testing note:** Same posture as previous plan — no unit-test runner exists in this project. Each task ends with a verification step (typecheck + smoke). The final smoke checklist runs after deploy.

---

## Task 1: Seed 9 new brand_doc slugs

**Files:**
- Create: `backend/src/migrations/2026-05-14-brand-doc-style-format-taxonomy.sql`

**Step 1: Create migration**

`backend/src/migrations/2026-05-14-brand-doc-style-format-taxonomy.sql`:

```sql
-- Brand-doc taxonomy: style (per network cluster) + format (per content_type).
--
-- Slugs are added alongside existing docs (no renames) so agent_scriptwriter_prompt
-- continues to reference style_guide_video / style_guide_text without breakage.
--
-- Each row is seeded with empty content. Operator fills via UI on /marketing-strategy.
-- ON CONFLICT DO NOTHING preserves any existing rows (e.g. style_guide_carousel
-- already exists with empty content from a previous migration — it stays).

INSERT INTO brand_docs (slug, title, content) VALUES
  ('style_instagram',       'Стиль: Instagram',           ''),
  ('style_tiktok_youtube',  'Стиль: TikTok + YouTube',    ''),
  ('style_telegram',        'Стиль: Telegram',            ''),
  ('format_short_video',    'Формат: Короткое видео',     ''),
  ('format_long_video',     'Формат: Длинное видео',      ''),
  ('format_carousel',       'Формат: Карусель',           ''),
  ('format_post',           'Формат: Пост',               ''),
  ('format_longread',       'Формат: Лонгрид',            ''),
  ('format_seo_article',    'Формат: SEO-статья',         '')
ON CONFLICT (slug) DO NOTHING;
```

**Step 2: Apply via Supabase MCP**

Use the Supabase MCP `apply_migration` tool. Project id is `jubkezbvccwvujregkfq` (visible from previous migrations). Migration name: `2026_05_14_brand_doc_style_format_taxonomy`. SQL = the file content above.

**Step 3: Verify**

Use Supabase MCP `execute_sql`:
```sql
SELECT slug, title, char_length(content) AS len
FROM brand_docs
WHERE slug LIKE 'style_%' OR slug LIKE 'format_%'
ORDER BY slug;
```

Expected: at least the 9 new slugs visible with `len = 0` plus pre-existing `style_guide_*` / `style_guide_carousel` slugs. Existing rows untouched (their `len` matches what was there before — operator can confirm `strategy_current` is still 21 KB by adjacent query).

**Step 4: Commit**

```bash
git add backend/src/migrations/2026-05-14-brand-doc-style-format-taxonomy.sql
git commit -m "feat(brand-docs): seed style + format taxonomy slugs"
```

---

## Task 2: Frontend — `BrandDocEditorModal` component

Reusable modal for editing any `BrandDoc` by slug. Same UX as `StrategyDocSection` but as a modal (so multiple docs can be edited from a card grid without page-level state).

**Files:**
- Create: `frontend/src/components/marketing/BrandDocEditorModal.tsx`

**Step 1: Implement component**

`frontend/src/components/marketing/BrandDocEditorModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'
import { brandDocsApi } from '../../api/brandDocs'
import type { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'

interface Props {
  slug: string
  title: string
  onClose: () => void
  /** Called after successful save so parent can refresh its summary view. */
  onSaved?: (doc: BrandDoc) => void
}

function errorMessage(e: unknown, fallback: string): string {
  // Loose-shape error reader — matches the pattern used in StrategyDocSection
  if (typeof e === 'object' && e && 'response' in e) {
    const r = (e as { response?: { data?: { error?: string } } }).response
    if (r?.data?.error) return String(r.data.error)
  }
  return fallback
}

export function BrandDocEditorModal({ slug, title, onClose, onSaved }: Props) {
  const toast = useToast()
  const [content, setContent] = useState<string>('')
  const [doc, setDoc] = useState<BrandDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load doc on open
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    brandDocsApi
      .get(slug)
      .then((d) => {
        if (cancelled) return
        setDoc(d)
        setContent(d?.content ?? '')
      })
      .catch((e) => {
        if (cancelled) return
        toast.error(errorMessage(e, 'Не удалось загрузить документ'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, toast])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [saving, onClose])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await brandDocsApi.upsert(slug, { title, content })
      setDoc(updated)
      toast.success('Сохранено')
      onSaved?.(updated)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e, 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-brand-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-semibold text-brand-text">{title}</h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">slug: <code>{slug}</code></p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              disabled={saving}
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="h-96 bg-muted rounded animate-pulse" />
          ) : (
            <>
              <textarea
                className="w-full min-h-[60vh] p-4 border border-brand-border rounded-2xl font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/40"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# ${title}\n\n…`}
                spellCheck={false}
              />
              {doc?.updated_at && (
                <p className="text-xs text-brand-text-secondary mt-2">
                  Обновлён: {new Date(doc.updated_at).toLocaleString('ru-RU')}
                  {doc.version ? ` · версия ${doc.version}` : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep BrandDocEditorModal`
Expected: empty (no errors from the new file).

**Step 3: Commit**

```bash
git add frontend/src/components/marketing/BrandDocEditorModal.tsx
git commit -m "feat(marketing): reusable BrandDocEditorModal"
```

---

## Task 3: Frontend — `BrandDocCardsSection` component + mount

**Files:**
- Create: `frontend/src/components/marketing/BrandDocCardsSection.tsx`
- Modify: `frontend/src/pages/MarketingStrategy.tsx`

**Step 1: Implement section component**

`frontend/src/components/marketing/BrandDocCardsSection.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { brandDocsApi } from '../../api/brandDocs'
import type { BrandDoc } from '../../api/types'
import { useToast } from '../../contexts/ToastContext'
import { BrandDocEditorModal } from './BrandDocEditorModal'

interface CardDef {
  slug: string
  icon: string
  title: string
  subtitle: string
}

const STYLE_CARDS: CardDef[] = [
  { slug: 'style_instagram',       icon: '📷', title: 'Instagram',          subtitle: 'Reels + Stories + Posts + Carousels' },
  { slug: 'style_tiktok_youtube',  icon: '🎬', title: 'TikTok + YouTube',   subtitle: 'Shorts + long video' },
  { slug: 'style_telegram',        icon: '💬', title: 'Telegram',           subtitle: 'Тёплая аудитория, long-form' },
]

const FORMAT_CARDS: CardDef[] = [
  { slug: 'format_short_video',  icon: '🎞️', title: 'Короткое видео',  subtitle: 'Reels / Shorts / TikTok' },
  { slug: 'format_long_video',   icon: '🎥', title: 'Длинное видео',   subtitle: 'YouTube long' },
  { slug: 'format_carousel',     icon: '🖼️', title: 'Карусель',        subtitle: 'Слайды + caption' },
  { slug: 'format_post',         icon: '📝', title: 'Пост',            subtitle: 'TG / VK короткие' },
  { slug: 'format_longread',     icon: '📄', title: 'Лонгрид',         subtitle: 'TG longread' },
  { slug: 'format_seo_article',  icon: '🔎', title: 'SEO-статья',      subtitle: 'Дзен / сайт' },
]

function formatKb(len: number): string {
  if (len === 0) return '0 KB · пусто'
  return `${(len / 1024).toFixed(1)} KB`
}

function formatShortDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function Card({
  def,
  doc,
  onClick,
}: {
  def: CardDef
  doc: BrandDoc | undefined
  onClick: () => void
}) {
  const len = doc?.content?.length ?? 0
  const date = formatShortDate(doc?.updated_at as unknown as string)
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-brand-border bg-card p-4 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-brand-text truncate">{def.title}</h3>
          <p className="text-xs text-brand-text-secondary truncate">{def.subtitle}</p>
        </div>
      </div>
      <p className="text-xs text-brand-text-secondary">
        {formatKb(len)}
        {date && len > 0 ? ` · ${date}` : ''}
      </p>
      <p className="mt-2 text-xs text-primary-600">
        {len === 0 ? 'Заполнить →' : 'Открыть →'}
      </p>
    </button>
  )
}

export const BrandDocCardsSection = () => {
  const toast = useToast()
  const [docs, setDocs] = useState<Record<string, BrandDoc>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CardDef | null>(null)

  const allSlugs = useMemo(
    () => [...STYLE_CARDS, ...FORMAT_CARDS].map((c) => c.slug),
    [],
  )

  const load = async () => {
    setLoading(true)
    try {
      const all = await brandDocsApi.list()
      const map: Record<string, BrandDoc> = {}
      for (const d of all) {
        if (allSlugs.includes(d.slug)) map[d.slug] = d
      }
      setDocs(map)
    } catch {
      toast.error('Не удалось загрузить документы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // intentionally one-shot — refresh happens via onSaved
  }, [])

  if (loading) {
    return (
      <section className="card mb-6">
        <div className="h-6 bg-muted rounded w-1/3 mb-3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-brand-text flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary-600" />
              <span>Гайдлайны и форматы</span>
            </h2>
            <p className="text-brand-text-secondary mt-1">
              Стилевые гайды по сетям и требования по форматам — на эти доки ссылается агент при генерации сценариев.
            </p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">
          🎨 Стиль по сетям
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {STYLE_CARDS.map((def) => (
            <Card
              key={def.slug}
              def={def}
              doc={docs[def.slug]}
              onClick={() => setEditing(def)}
            />
          ))}
        </div>

        <h3 className="text-sm font-semibold text-brand-text-secondary uppercase tracking-wider mb-2">
          📐 Требования по форматам
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {FORMAT_CARDS.map((def) => (
            <Card
              key={def.slug}
              def={def}
              doc={docs[def.slug]}
              onClick={() => setEditing(def)}
            />
          ))}
        </div>
      </section>

      {editing && (
        <BrandDocEditorModal
          slug={editing.slug}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load()
          }}
        />
      )}
    </>
  )
}
```

**Step 2: Mount on MarketingStrategy page**

Modify `frontend/src/pages/MarketingStrategy.tsx`. Add import and insert section between `ThemesSection` and `BudgetsSection`:

```tsx
import { StrategyDocSection } from '../components/marketing/StrategyDocSection'
import { SegmentsSection } from '../components/marketing/SegmentsSection'
import { ThemesSection } from '../components/marketing/ThemesSection'
import { BrandDocCardsSection } from '../components/marketing/BrandDocCardsSection'
import { BudgetsSection } from '../components/marketing/BudgetsSection'

const MarketingStrategy = () => {
  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text">Маркетинг-стратегия</h1>
        <p className="text-brand-text-secondary mt-1">
          Стратегический документ, целевые сегменты, тематические фокусы и бюджеты каналов.
        </p>
      </header>

      <StrategyDocSection />
      <SegmentsSection />
      <ThemesSection />
      <BrandDocCardsSection />
      <BudgetsSection />
    </div>
  )
}

export default MarketingStrategy
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "BrandDocCards|MarketingStrategy"`
Expected: empty.

**Step 4: Commit**

```bash
git add frontend/src/components/marketing/BrandDocCardsSection.tsx frontend/src/pages/MarketingStrategy.tsx
git commit -m "feat(marketing): BrandDocCardsSection with 9 style+format cards"
```

---

## Task 4: Frontend — Universal «🪄 Сгенерить» button on Production tab

Adds a new button at the top of the Production tab. Replaces the old carousel-specific button on the Идея tab. The new button uses pure frontend trigger assembly — no backend call.

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Step 1: Create the trigger builder helper**

At the top of `UnitEditModal.tsx`, **before** `function CarouselSlideList(...)` (around line 93), add a module-level helper:

```tsx
/**
 * Maps a unit's networks + content_type to brand-doc slugs the agent should
 * consult, then assembles a short trigger phrase pointing claude.ai at the
 * agent-scriptwriter workflow stored in brand_docs.
 *
 * No backend involved — Claude reads brand_docs via Supabase MCP.
 */
function buildScriptTrigger(unit: ContentUnit): string {
  // Style cluster by network — see design doc §3
  const networks = new Set(unit.publications.map((p) => p.network))
  const styleSlugs: string[] = []
  if (networks.has('instagram')) styleSlugs.push('style_instagram')
  if (networks.has('telegram')) styleSlugs.push('style_telegram')
  if (
    networks.has('tiktok') ||
    networks.has('youtube') ||
    networks.has('youtube_shorts')
  ) {
    styleSlugs.push('style_tiktok_youtube')
  }
  if (styleSlugs.length === 0) styleSlugs.push('style_tiktok_youtube')

  // Format by content_type — see design doc §3
  const FORMAT_SLUG: Record<string, string> = {
    short_video: 'format_short_video',
    long_video: 'format_long_video',
    carousel: 'format_carousel',
    short_post: 'format_post',
    long_post: 'format_longread',
    seo_article: 'format_seo_article',
    stream: 'format_long_video',
    podcast: 'format_long_video',
    email_newsletter: 'format_longread',
    lead_magnet_pdf: 'format_longread',
    marketplace_card: 'format_post',
    ad_creative: 'format_post',
    text_post: 'format_post',
    other: 'format_post',
  }
  const formatSlug = FORMAT_SLUG[unit.content_type] ?? 'format_post'

  const styleList = styleSlugs.map((s) => `brand_docs.${s}`).join(' и ')

  return `Запусти сценариста для юнита ${unit.id}.

Контекст (читай через Supabase MCP, project jubkezbvccwvujregkfq):
- Стратегия: brand_docs.strategy_current
- Рубрики: brand_docs.rubrics_matrix
- Стиль по кластеру сетей: ${styleList}
- Формат: brand_docs.${formatSlug}
- ICP: icp_segment (id = u.target_segment_id) + channel_segment_priority
- SKU (если рубрика product_himichka или явно упомянут SKU): kits + kit_unique_features + kit_reviews_curated + kit_use_cases + brand_docs.kit_himichka / kit_mini_himichka / kit_electrohimichka
- Эталон рубрики: SELECT script FROM content_units WHERE rubric_id = u.rubric_id AND notes ILIKE '%ЭТАЛОН%' LIMIT 1

Действуй по agent_scriptwriter_prompt §0.5 (определи CREATE vs AUDIT по наличию script_text/voiceover_text), §1 (выбор артефактов по format_type), §2 (применение правил). Перед UPDATE — snapshot_content_unit().`
}
```

**Step 2: Rename `handleWriteScript` to `handleGenerate` and adapt body**

Replace the entire `handleWriteScript` function (around line 313–365) with `handleGenerate`. Keep the same `scriptBusy` state and the existing autosave-before-trigger + clipboard fallback + window.open logic, but swap the trigger source:

```tsx
const handleGenerate = async () => {
  const persistedId = unitInternal?.id ?? (unit !== 'new' ? unit.id : null)
  if (!persistedId) {
    toast.error('Сначала сохрани юнит')
    return
  }

  setScriptBusy(true)
  try {
    // Autosave — flushes any unsaved edits to script_text / caption / slides
    // so they make it into the unit row before the agent reads.
    const saved = await handleSave({ silent: true })
    if (!saved) return // validation toast fired by handleSave

    const trigger = buildScriptTrigger(saved)

    let copied = true
    try {
      await navigator.clipboard.writeText(trigger)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = trigger
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        copied = document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }

    if (!copied) {
      toast.error('Не удалось скопировать промпт в буфер.')
      return
    }

    const opened = window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer')
    if (!opened) {
      toast.info('Промпт в буфере. Открой claude.ai и вставь (Cmd/Ctrl+V).')
    } else {
      toast.success('Промпт скопирован — вставь в Claude (Cmd/Ctrl+V)')
    }
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' && e && 'response' in e
        ? String(
            (e as { response?: { data?: { error?: string } } }).response?.data
              ?.error ?? 'Не удалось подготовить триггер',
          )
        : 'Не удалось подготовить триггер'
    toast.error(msg)
  } finally {
    setScriptBusy(false)
  }
}
```

Note: the `axios.isAxiosError` import becomes unused if no other handler references it. Verify and leave the import only if `handleSave` still uses it (it does — check around line 219).

**Step 3: Add the universal button at the top of the Production tab**

Inside the Production tab JSX (around line 786, just inside `{tab === 'production' && (<>` ), **before** the conditional placeholders (line 788), add:

```tsx
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-brand-border">
            <div>
              <h3 className="text-sm font-semibold text-brand-text">🎬 Производство</h3>
              <p className="text-xs text-brand-text-secondary">
                Сгенерировать через агента-сценариста или редактировать вручную.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={scriptBusy || saving || (unit === 'new' && !unitInternal)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                scriptBusy ? 'Готовлю промпт…' :
                saving ? 'Дождись завершения сохранения' :
                (unit === 'new' && !unitInternal) ? 'Сначала сохрани юнит' :
                'Сборка триггера и открытие Claude'
              }
            >
              <Sparkles size={16} />
              {scriptBusy ? 'Готовлю промпт…' : 'Сгенерить сценарий'}
            </button>
          </div>
```

Note: the existing `<section>` at line 832 already has an `<h3>🎬 Производство</h3>` — remove that duplicate header in Step 5 below.

**Step 4: Remove the old carousel-specific button on the Идея tab**

In the carousel branch of `renderTypeFields()` (around lines 384–414), the «Подпись поста» block currently looks like:

```tsx
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Подпись поста</label>
              <button type="button" onClick={handleWriteScript} ...>
                <Sparkles size={14} />
                {scriptBusy ? 'Готовлю промпт…' : 'Написать сценарий'}
              </button>
            </div>
            <textarea ... />
          </div>
```

Replace with a plain label + textarea (button removed):

```tsx
          <div>
            <label className="label">Подпись поста</label>
            <textarea
              className="input"
              rows={6}
              placeholder="Текст под каруселью — что увидит читатель в ленте"
              value={formData.body_caption}
              onChange={(e) => setFormData({ ...formData, body_caption: e.target.value })}
            />
          </div>
```

**Step 5: Remove duplicate `<h3>🎬 Производство</h3>` from inner video-production section**

The inner section at line 832-833 currently has its own header. Remove that header since the new top-of-tab header (added in Step 3) covers it:

Before:
```tsx
          {isVideoProducing && (
          <section className="space-y-3 border-t border-brand-border pt-4">
            <h3 className="text-sm font-semibold text-brand-text">🎬 Производство</h3>
            ...
```

After:
```tsx
          {isVideoProducing && (
          <section className="space-y-3">
            ...
```

(Removed the `<h3>` line and the `border-t border-brand-border pt-4` classes since the new top header has the divider.)

**Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep UnitEditModal`
Expected: empty.

**Step 7: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): universal «Сгенерить» button on Production tab"
```

---

## Task 5: Cleanup — remove yesterday's carousel-specific backend code

The new `handleGenerate` doesn't call the backend, so the entire `script-prompt` endpoint and service are dead code.

**Files:**
- Delete: `backend/src/services/script-prompt-builder.ts`
- Modify: `backend/src/controllers/content-unit.controller.ts` (remove import + method)
- Modify: `backend/src/routes/content-unit.routes.ts` (remove route)
- Modify: `frontend/src/api/contentBank.ts` (remove `unitsApi.scriptPrompt`)

**Step 1: Delete the service**

```bash
rm backend/src/services/script-prompt-builder.ts
```

**Step 2: Remove import + method in controller**

In `backend/src/controllers/content-unit.controller.ts`:
- Remove the line `import { buildScriptPrompt } from '../services/script-prompt-builder'` (near top).
- Remove the entire `scriptPrompt` method (around line 740-761), including the leading blank line and the trailing comma.

After removal the closing `}` of `contentUnitController` object literal should sit directly after `patchRecipeState`.

**Step 3: Remove route**

In `backend/src/routes/content-unit.routes.ts`, remove the line:

```ts
router.post('/:id/script-prompt', contentUnitController.scriptPrompt)
```

**Step 4: Remove frontend API method**

In `frontend/src/api/contentBank.ts`, remove the entire `scriptPrompt` block inside `unitsApi`:

```ts
  scriptPrompt: async (id: string): Promise<{ prompt: string }> => {
    const r = await apiClient.post<{ prompt: string }>(`/content-units/${id}/script-prompt`)
    return r.data
  },
```

**Step 5: Typecheck both sides**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "js-yaml"
cd ../frontend && npx tsc --noEmit 2>&1 | grep -E "UnitEditModal|contentBank"
```
Both must be empty.

**Step 6: Commit**

```bash
git add -A backend/src/services/script-prompt-builder.ts \
         backend/src/controllers/content-unit.controller.ts \
         backend/src/routes/content-unit.routes.ts \
         frontend/src/api/contentBank.ts
git commit -m "chore(content-bank): remove obsolete script-prompt endpoint and service"
```

(`git add -A` includes the deletion of the service file. Verify with `git status` before commit — only those 4 paths should appear, one as deleted.)

---

## Task 6: Final smoke + push to both remotes

**Step 1: Local-dev smoke checklist**

Pre-flight:
- Backend running: `cd backend && npm run dev`
- Frontend running: `cd frontend && npm run dev`
- Logged in as admin

Smoke items (covers design doc §Testing):

1. **`/marketing-strategy` renders.** Section «Гайдлайны и форматы» appears between «Тематические фокусы» and «Бюджеты каналов». 3 «Стиль» cards + 6 «Формат» cards.
2. **Empty stubs.** All 9 cards show `0 KB · пусто` + «Заполнить →».
3. **Editor modal opens.** Click `format_carousel` card → modal opens with title «Формат: Карусель», empty textarea. Type a few lines, click «Сохранить» → toast «Сохранено», modal closes. Card now shows `~0.1 KB · 14.05` + «Открыть →».
4. **Editor cancel.** Click another card, type something, press Esc → modal closes without saving. Re-open → previous content (or stub) intact.
5. **Universal button — short_video unit.** Open a `short_video` unit with at least one publication on TikTok or YouTube. Production tab → click «🪄 Сгенерить сценарий». Paste into a scratch buffer → trigger contains `style_tiktok_youtube` and `format_short_video`. Toast «Промпт скопирован — вставь в Claude».
6. **Universal button — carousel unit.** Open a `carousel` unit with a publication on Instagram. Trigger contains `style_instagram` + `format_carousel`.
7. **Universal button — TG post.** Open a `short_post` unit on Telegram → `style_telegram` + `format_post`.
8. **Disabled state.** Create new unit, don't save → «Сгенерить» button disabled with tooltip «Сначала сохрани юнит».
9. **Carousel caption block.** On the Идея tab for a carousel unit, the «🪄 Написать сценарий» button is **gone** — only the «Подпись поста» label + textarea.
10. **Old endpoint dead.** `curl http://localhost:3001/api/content-units/<id>/script-prompt -X POST -H "Authorization: Bearer <token>"` → HTTP 404. Confirmed removed.
11. **No regressions.** Footer Save button on existing units behaves normally with «Сохранено» toast.

If any check fails — fix and re-run before pushing.

**Step 2: Push to both remotes**

```bash
git push origin main
git push vercel-deploy main
```

Expected: clean pushes (no non-fast-forward rejections). If rejection occurs (parallel session pushed), follow the same rebase workflow as before: `git stash -u; git pull --rebase origin main; git stash pop; git push origin main; git push vercel-deploy main`.

**Step 3: Prod smoke**

Wait ~2-3 minutes for Railway + Vercel deploys. Re-run items 1, 5, 9 from Step 1's checklist on prod URL. Cross-browser clipboard sanity (Chrome + Safari + Firefox).

---

## Reference: skill bridges

- @superpowers:executing-plans — execute this plan task-by-task (subagent-driven if invoked from this session)
- @superpowers:systematic-debugging — if something fails during smoke
- @superpowers:verification-before-completion — verify before marking done

## Principles baked in

- **DRY** — reuse `brandDocsApi` pattern from `StrategyDocSection` for the new modal.
- **YAGNI** — no markdown preview, no version history, no audit/feedback button in UI (round-trip via Claude chat).
- **TDD adapted** — each task ends with typecheck + smoke (project has no test runner).
- **Frequent commits** — 6 atomic commits, each can be reviewed/reverted independently.
