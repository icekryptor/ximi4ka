# Carousel Body Text + «Написать сценарий» Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Дать `content_type === 'carousel'` нормальную модель данных (caption + slides[]) и кнопку «Написать сценарий», которая собирает промт из маркетинг-стратегии + гайдлайна карусели + рубрики + полей юнита и кладёт в буфер обмена + открывает claude.ai/new.

**Architecture:** Точечно — две nullable-колонки на `content_units` (`body_caption text`, `slides jsonb`), новый `POST /api/content-units/:id/script-prompt` (pure string builder, без Anthropic API), новая ветка `if (content_type === 'carousel')` в `UnitEditModal.renderTypeFields()`. Никакого recipe-движка пока (Phase C plan — отдельный PR в будущем).

**Tech Stack:** TypeORM + Postgres (Supabase) бэк, React + TS + Tailwind фронт, lucide-react иконки, `navigator.clipboard.writeText` + `window.open` для интеграции с Claude.

**Design reference:** `docs/plans/2026-05-13-carousel-script-button-design.md`

**Testing note:** В проекте нет настроенного test-runner ни на бэке (`jest`), ни на фронте (`vitest`). По решению дизайна — автотесты не пишем; вместо них на каждом шаге smoke-проверка (typecheck + curl/click). Это адаптация TDD-флоу под существующий фундамент проекта.

---

## Task 1: Backend — миграция БД и колонки в `ContentUnit`

**Files:**
- Create: `backend/src/migrations/2026-05-13-carousel-body-slides.sql`
- Modify: `backend/src/entities/ContentUnit.ts:103` (после `voiceover_text`, перед `ready_at`)

**Step 1: Создать миграцию**

Создай файл `backend/src/migrations/2026-05-13-carousel-body-slides.sql`:

```sql
-- Carousel body text + slides[] for content_type = 'carousel'
--
-- Both columns are nullable: non-carousel content_types leave them NULL.
-- slides is jsonb with shape: [{text: string, visual: string}, ...]
-- Empty slides (both fields blank) are filtered out at write time by the controller.

ALTER TABLE content_units
  ADD COLUMN IF NOT EXISTS body_caption text,
  ADD COLUMN IF NOT EXISTS slides       jsonb;
```

**Step 2: Применить миграцию на Supabase**

Через Supabase MCP `apply_migration` или вручную:
```bash
psql "$DATABASE_URL" -f backend/src/migrations/2026-05-13-carousel-body-slides.sql
```

Ожидание: команда возвращает `ALTER TABLE`, без ошибок.

**Step 3: Проверка применения**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'content_units' AND column_name IN ('body_caption', 'slides');
```

Ожидание: две строки — `body_caption (text, YES)`, `slides (jsonb, YES)`.

**Step 4: Добавить поля в TypeORM entity**

В `backend/src/entities/ContentUnit.ts`, **после** строки `voiceover_text: string | null` (около строки 103) и **перед** `ready_at`:

```typescript
  @Column({ type: 'text', nullable: true })
  body_caption: string | null

  @Column({ type: 'jsonb', nullable: true })
  slides: Array<{ text: string; visual: string }> | null
```

**Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors (или только pre-existing, не из этого файла).

**Step 6: Commit**

```bash
git add backend/src/migrations/2026-05-13-carousel-body-slides.sql backend/src/entities/ContentUnit.ts
git commit -m "feat(content-bank): add body_caption + slides[] columns for carousel"
```

---

## Task 2: Backend — pure script-prompt builder service

**Files:**
- Create: `backend/src/services/script-prompt-builder.ts`

**Step 1: Создать сервис**

Создай файл `backend/src/services/script-prompt-builder.ts`:

```typescript
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'

const STRATEGY_SLUG = 'strategy_current'
const CAROUSEL_GUIDELINE_SLUG = 'style_guide_carousel'

/**
 * Builds a self-contained prompt for Claude that includes:
 * - Marketing strategy (north star) — BrandDoc[slug='strategy_current']
 * - Carousel style guide — BrandDoc[slug='style_guide_carousel']
 * - Rubric tone/audience/CTA
 * - Unit draft: title, hook, essence, body_caption, slides
 *
 * Missing sources (no rubric, empty guideline) are silently omitted —
 * the prompt stays well-formed instead of leaking 'null'/'undefined'.
 *
 * Side effect: if BrandDoc[slug='style_guide_carousel'] is missing, creates
 * an empty stub so the user can fill it from the UI without redeploying.
 *
 * @throws Error with message 'unit_not_found' if the unit doesn't exist
 * @throws Error with message 'not_carousel' if content_type !== 'carousel'
 */
export async function buildScriptPrompt(unitId: string): Promise<string> {
  const unitRepo = AppDataSource.getRepository(ContentUnit)
  const docRepo = AppDataSource.getRepository(BrandDoc)

  const unit = await unitRepo.findOne({
    where: { id: unitId },
    relations: ['rubric'],
  })
  if (!unit) throw new Error('unit_not_found')
  if (unit.content_type !== 'carousel') throw new Error('not_carousel')

  // Load both brand docs in a single query.
  const docs = await docRepo.find({
    where: { slug: In([STRATEGY_SLUG, CAROUSEL_GUIDELINE_SLUG]) },
  })
  const docMap = new Map(docs.map((d) => [d.slug, d.content]))

  // Auto-seed carousel guideline doc so it appears in the BrandDoc editor.
  if (!docMap.has(CAROUSEL_GUIDELINE_SLUG)) {
    const stub = docRepo.create({
      slug: CAROUSEL_GUIDELINE_SLUG,
      title: 'Гайдлайн карусели',
      content: '',
    })
    await docRepo.save(stub)
    docMap.set(CAROUSEL_GUIDELINE_SLUG, '')
  }

  const strategy = docMap.get(STRATEGY_SLUG) ?? ''
  const guideline = docMap.get(CAROUSEL_GUIDELINE_SLUG) ?? ''

  const parts: string[] = []

  if (strategy.trim()) {
    parts.push('[NORTH STAR — МАРКЕТИНГ-СТРАТЕГИЯ]')
    parts.push(strategy.trim())
  }

  if (guideline.trim()) {
    parts.push('[ГАЙДЛАЙН ПО КАРУСЕЛЯМ]')
    parts.push(guideline.trim())
  }

  if (unit.rubric) {
    const r = unit.rubric
    const rubricLines = [`[РУБРИКА: ${r.title}]`]
    if (r.tone) rubricLines.push(`Tone: ${r.tone}`)
    if (r.audience) rubricLines.push(`Audience: ${r.audience}`)
    if (r.cta_template) rubricLines.push(`CTA: ${r.cta_template}`)
    if (rubricLines.length > 1) parts.push(rubricLines.join('\n'))
  }

  const taskLines = ['[ЗАДАЧА]', 'Тип: карусель']
  taskLines.push(`Название: ${unit.title}`)
  if (unit.hook) taskLines.push(`Hook: ${unit.hook}`)
  if (unit.essence) taskLines.push(`Суть: ${unit.essence}`)
  taskLines.push('')
  taskLines.push(`Подпись (draft): ${unit.body_caption?.trim() || '<пусто>'}`)
  taskLines.push('Слайды (draft):')
  const slides = Array.isArray(unit.slides) ? unit.slides : []
  if (slides.length === 0) {
    taskLines.push('  <слайды ещё не описаны>')
  } else {
    slides.forEach((s, i) => {
      taskLines.push(`  ${i + 1}. text: ${s.text?.trim() || '<пусто>'}`)
      taskLines.push(`     visual: ${s.visual?.trim() || '<пусто>'}`)
    })
  }
  parts.push(taskLines.join('\n'))

  parts.push(
    '[ЧТО НУЖНО]\n' +
      'Напиши финальную версию: подпись поста и текст каждого слайда. ' +
      'Соблюдай гайдлайн и тон рубрики. Опирайся на маркетинг-стратегию как на north star. ' +
      'Для каждого слайда дай: (а) короткий текст на самом слайде, (б) визуальную идею.',
  )

  return parts.join('\n\n')
}
```

**Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors from this file.

**Step 3: Commit**

```bash
git add backend/src/services/script-prompt-builder.ts
git commit -m "feat(content-bank): script-prompt-builder service for carousels"
```

---

## Task 3: Backend — controller method + route

**Files:**
- Modify: `backend/src/controllers/content-unit.controller.ts` (add new method after `patchRecipeState`)
- Modify: `backend/src/routes/content-unit.routes.ts` (add new route)

**Step 1: Добавить метод в controller**

В `backend/src/controllers/content-unit.controller.ts`, найди конец метода `patchRecipeState` (после строки 735 примерно) и **перед** закрывающей `}` экспорта `contentUnitController` добавь:

```typescript
  async scriptPrompt(req: Request, res: Response) {
    try {
      const { id } = req.params
      const prompt = await buildScriptPrompt(id)
      res.json({ prompt })
    } catch (e: any) {
      if (e?.message === 'unit_not_found') {
        return res.status(404).json({ error: 'Юнит не найден' })
      }
      if (e?.message === 'not_carousel') {
        return res.status(400).json({ error: 'Сценарий пока доступен только для каруселей' })
      }
      console.error(
        '[content-units.scriptPrompt] FAILED',
        'name=', e?.name,
        'message=', e?.message,
        '\nstack=', e?.stack,
      )
      res.status(500).json({ error: 'Не удалось собрать промпт' })
    }
  },
```

Добавь import в верх файла:

```typescript
import { buildScriptPrompt } from '../services/script-prompt-builder'
```

(Проверь, нет ли уже похожих imports — если есть `../services/recipe-engine`, добавь рядом.)

**Step 2: Добавить роут**

В `backend/src/routes/content-unit.routes.ts`, после `router.patch('/:id/recipe-state', contentUnitController.patchRecipeState)`:

```typescript
router.post('/:id/script-prompt', contentUnitController.scriptPrompt)
```

**Step 3: Typecheck backend**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors from these files.

**Step 4: Запустить бэк локально и проверить cURL'ом**

Запусти бэк: `cd backend && npm run dev` (порт 3001).

Найди UUID карусели в БД:
```sql
SELECT id, title, content_type FROM content_units WHERE content_type = 'carousel' LIMIT 1;
```

Если каруселей в БД нет — создай одну через UI (`/content-bank` → «Добавить» → tип «🖼️ Карусель» → название → сохранить), затем достань её id.

Достань JWT из браузера: `localStorage.getItem('token')` в консоли при открытом фронте.

Тест cURL:
```bash
curl -X POST http://localhost:3001/api/content-units/<UUID>/script-prompt \
  -H "Authorization: Bearer <TOKEN>" -v
```

Expected:
- HTTP 200
- JSON `{ prompt: "[NORTH STAR — МАРКЕТИНГ-СТРАТЕГИЯ]\n...\n[ЗАДАЧА]\nТип: карусель\n..." }`
- В Supabase появилась строка в `brand_docs` со slug `style_guide_carousel` (если её не было).

Тест на non-carousel:
```bash
curl -X POST http://localhost:3001/api/content-units/<NON_CAROUSEL_UUID>/script-prompt \
  -H "Authorization: Bearer <TOKEN>" -v
```
Expected: HTTP 400, JSON `{ error: 'Сценарий пока доступен только для каруселей' }`.

**Step 5: Commit**

```bash
git add backend/src/controllers/content-unit.controller.ts backend/src/routes/content-unit.routes.ts
git commit -m "feat(content-bank): POST /api/content-units/:id/script-prompt endpoint"
```

---

## Task 4: Frontend — типы и API метод

**Files:**
- Modify: `frontend/src/api/contentBank.ts:62-91` (interface `ContentUnit`) и `:154` (`unitsApi`)

**Step 1: Расширить `ContentUnit` interface**

В `frontend/src/api/contentBank.ts`, найди `interface ContentUnit` (около строки 62). После `theme_id: string | null` (последнее поле сейчас) добавь:

```typescript
  body_caption: string | null
  slides: CarouselSlide[] | null
```

И **в начале файла**, после `export type ReviewGrade = ...` (около строки 31), добавь:

```typescript
export interface CarouselSlide {
  text: string
  visual: string
}
```

**Step 2: Добавить `scriptPrompt` метод в `unitsApi`**

В том же файле, найди `export const unitsApi = { ... }` (около строки 154). Внутри объекта, после `purgeRejected: ...` или в конце, добавь:

```typescript
  scriptPrompt: async (id: string): Promise<{ prompt: string }> => {
    const r = await apiClient.post<{ prompt: string }>(`/content-units/${id}/script-prompt`)
    return r.data
  },
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "contentBank|UnitEditModal"`
Expected: пусто (нет ошибок в наших файлах).

**Step 4: Commit**

```bash
git add frontend/src/api/contentBank.ts
git commit -m "feat(content-bank): API types for carousel body+slides and scriptPrompt method"
```

---

## Task 5: Frontend — ветка carousel в форме (caption + slides)

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Step 1: Расширить `formData` стейт**

В `frontend/src/components/content-bank/UnitEditModal.tsx`, найди interface `FormData` (около строки 28-44) и добавь:

```typescript
  body_caption: string
  slides: CarouselSlide[]
```

В верх файла добавь import:

```typescript
import type { CarouselSlide } from '../../api/contentBank'
```

(Скорее всего `ContentUnit` уже импортирован из `contentBank` — добавь `CarouselSlide` к существующему import.)

**Step 2: Обновить инициализацию `formData`**

В начале компонента (около строки 50), где формируется `defaultFormData` / `initFromUnit`, добавь оба поля:

В `defaultFormData` (или эквивалент — около строки 50):
```typescript
  body_caption: '',
  slides: [],
```

В функции/блоке, где `formData` инициализируется из `unit` (около строки 68):
```typescript
  body_caption: unit.body_caption ?? '',
  slides: Array.isArray(unit.slides) ? unit.slides : [],
```

В `handleSave` / `payload`-сборке (около строки 152) добавь:
```typescript
  body_caption: formData.body_caption || null,
  slides: formData.slides.filter((s) => s.text.trim() || s.visual.trim()),
```

(Фильтр здесь — последний рубеж; на бэке тоже можно фильтровать, но это дешевле сделать тут.)

**Step 3: Добавить локальный компонент `CarouselSlideList`**

Внутри файла, **выше** определения `function UnitEditModal(...)`, добавь:

```typescript
function CarouselSlideList({
  slides,
  onChange,
}: {
  slides: CarouselSlide[]
  onChange: (next: CarouselSlide[]) => void
}) {
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...slides]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  const update = (idx: number, patch: Partial<CarouselSlide>) => {
    onChange(slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const remove = (idx: number) => {
    onChange(slides.filter((_, i) => i !== idx))
  }

  const add = () => {
    onChange([...slides, { text: '', visual: '' }])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label mb-0">Слайды</label>
        <button
          type="button"
          onClick={add}
          className="text-xs px-2 py-1 rounded-lg border border-brand-border hover:bg-subtle"
        >
          + Добавить слайд
        </button>
      </div>

      {slides.length === 0 ? (
        <p className="text-sm text-brand-text-secondary">Слайдов пока нет</p>
      ) : (
        <ul className="space-y-3">
          {slides.map((slide, i) => (
            <li key={i} className="border border-brand-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-text">Слайд {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-subtle disabled:opacity-30"
                    aria-label="Вверх"
                  >
                    ⬆
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === slides.length - 1}
                    className="p-1 rounded hover:bg-subtle disabled:opacity-30"
                    aria-label="Вниз"
                  >
                    ⬇
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="p-1 rounded hover:bg-red-50 text-red-600"
                    aria-label="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="Текст на слайде"
                value={slide.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <textarea
                className="input"
                rows={2}
                placeholder="Визуал / бриф для дизайнера"
                value={slide.visual}
                onChange={(e) => update(i, { visual: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 4: Добавить ветку `if (content_type === 'carousel')` в `renderTypeFields`**

В функции `renderTypeFields` (около строки 212), **перед** существующей веткой `if (formData.content_type === 'short_post')`, добавь:

```typescript
    if (formData.content_type === 'carousel') {
      return (
        <>
          <div>
            <label className="label">Подпись поста</label>
            <textarea
              className="input"
              rows={6}
              placeholder="Текст под каруселью — что увидит читатель в ленте"
              value={formData.body_caption}
              onChange={(e) => setFormData({ ...formData, body_caption: e.target.value })}
            />
            {/* Кнопка «Написать сценарий» будет добавлена в Task 6 */}
          </div>
          <CarouselSlideList
            slides={formData.slides}
            onChange={(slides) => setFormData({ ...formData, slides })}
          />
          <div>
            <label className="label">Заметки</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Любые внутренние заметки"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </>
      )
    }
```

**Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "UnitEditModal|contentBank"`
Expected: пусто.

**Step 6: Smoke check в браузере (локально)**

1. Запусти `cd frontend && npm run dev`.
2. Открой `/content-bank`, нажми «Добавить».
3. Выбери тип «🖼️ Карусель» — должна показаться форма: «Подпись поста» textarea, блок «Слайды» (пустой) с кнопкой «+ Добавить слайд», «Заметки» textarea.
4. Hook/Hook A/B/Визуал/Суть **не должны быть видны** в этой ветке.
5. Добавь 2 слайда, заполни их, переставь ⬆⬇, удали один, заполни caption, введи название, сохрани. После сохранения данные должны вернуться с сервера и отобразиться в том же виде.
6. Создай ещё одну карусель без слайдов (только caption) — сохрани, проверь, что не падает.

**Step 7: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): carousel form — caption + slides[] with reorder"
```

---

## Task 6: Frontend — кнопка «Написать сценарий»

**Files:**
- Modify: `frontend/src/components/content-bank/UnitEditModal.tsx`

**Step 1: Добавить состояние и handler**

В `UnitEditModal.tsx` найди другие `useState` объявления (около строки 45) и добавь:

```typescript
const [scriptBusy, setScriptBusy] = useState(false)
```

Импорт `Sparkles` из `lucide-react` — найди существующий `import { ... } from 'lucide-react'` (вверху файла) и добавь `Sparkles` в список.

После `handleSave` (или после других async-функций в начале компонента, около строки 160) добавь:

```typescript
const handleWriteScript = async () => {
  // Юнит должен быть сохранён, иначе нет id для запроса.
  const persistedId = unitInternal?.id ?? (unit !== 'new' ? unit.id : null)
  if (!persistedId) {
    toast.error('Сначала сохрани юнит')
    return
  }

  setScriptBusy(true)
  try {
    // Автосейв на случай несохранённых изменений caption/slides — иначе
    // в промпт уйдёт «вчерашняя» версия.
    const saved = await handleSave({ silent: true })
    const targetId = saved?.id ?? persistedId

    const { prompt } = await unitsApi.scriptPrompt(targetId)

    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // clipboard API недоступен (HTTP, или браузер отказал) — fallback
      // через legacy execCommand.
      const textarea = document.createElement('textarea')
      textarea.value = prompt
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }

    const opened = window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer')
    if (!opened) {
      toast.info('Промпт в буфере. Открой claude.ai и вставь (Cmd/Ctrl+V).')
    } else {
      toast.success('Промпт скопирован — вставь в Claude (Cmd/Ctrl+V)')
    }
  } catch (e: any) {
    const msg = e?.response?.data?.error || 'Не удалось собрать промпт'
    toast.error(msg)
  } finally {
    setScriptBusy(false)
  }
}
```

**Важно:** проверь, что у текущего `handleSave` есть либо параметр `silent` (приглушающий success-toast), либо он молчит по умолчанию — иначе автосейв будет дублировать тост. Если параметра нет, посмотри сигнатуру `handleSave` и адаптируй вызов (например, временно отключи success-toast в `handleSave`, или не приглушай — лишний тост не критичен).

**Step 2: Добавить кнопку рядом с caption**

В ветке `if (formData.content_type === 'carousel')` в `renderTypeFields` замени текущий блок «Подпись поста» на:

```typescript
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Подпись поста</label>
              <button
                type="button"
                onClick={handleWriteScript}
                disabled={scriptBusy || saving || (unit === 'new' && !unitInternal)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  unit === 'new' && !unitInternal
                    ? 'Сначала сохрани юнит'
                    : 'Сборка промпта и открытие Claude'
                }
              >
                <Sparkles size={14} />
                {scriptBusy ? 'Готовлю промпт…' : 'Написать сценарий'}
              </button>
            </div>
            <textarea
              className="input"
              rows={6}
              placeholder="Текст под каруселью — что увидит читатель в ленте"
              value={formData.body_caption}
              onChange={(e) => setFormData({ ...formData, body_caption: e.target.value })}
            />
          </div>
```

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "UnitEditModal"`
Expected: пусто.

**Step 4: Smoke check**

1. С запущенным бэком и фронтом открой существующую карусель.
2. Кнопка «Написать сценарий» должна быть видна над textarea подписи.
3. Если юнит новый и не сохранён — кнопка disabled, tooltip говорит «Сначала сохрани юнит».
4. На сохранённом юните: измени caption, нажми «Написать сценарий».
   - Через секунду — тост «Промпт скопирован…».
   - Открылась вкладка `claude.ai/new`.
   - Cmd+V в новом чате — вставился промпт с блоками north star / гайдлайна / рубрики / задачи / твоим обновлённым caption.
5. Попробуй на short_video юните (через DevTools, дёргая API напрямую, или временно создав карусель и переключив content_type): должен прилететь toast.error «Сценарий пока доступен только для каруселей».

**Step 5: Commit**

```bash
git add frontend/src/components/content-bank/UnitEditModal.tsx
git commit -m "feat(content-bank): «Написать сценарий» button — prompt → clipboard → claude.ai"
```

---

## Task 7: Финальный smoke-чеклист и push

**Step 1: Прогнать полный smoke-чеклист** (из дизайн-документа, секция 5/5)

Pre-flight:
- бэк запущен (`cd backend && npm run dev`)
- фронт запущен (`cd frontend && npm run dev`)
- залогинился под admin

Чек-лист:
1. ✅ Миграция накатилась — `\d content_units` в psql или Supabase MCP показывает `body_caption text` и `slides jsonb`.
2. ✅ Создание карусели — `/content-bank` → «Добавить» → тип «🖼️ Карусель» → форма правильная.
3. ✅ Слайды: + / ⬆⬇ / ✕ работают, порядок сохраняется после reload.
4. ✅ Пустые слайды (оба поля blank) фильтруются — после сохранения остаются только заполненные.
5. ✅ Смена `content_type` карусель → short_post → карусель — caption и slides на месте (фронт их не зануляет).
6. ✅ Кнопка «Написать сценарий»:
   - disabled на новом несохранённом юните,
   - на сохранённом: clipboard содержит промпт, `claude.ai/new` открыт, тост ОК.
   - с unsaved-изменениями — автосейв перед сборкой.
7. ✅ Промпт корректный — содержит все четыре блока, со свежим caption/slides.
8. ✅ Авто-сид: после первого клика `SELECT slug, title FROM brand_docs WHERE slug='style_guide_carousel'` возвращает строку.
9. ✅ Non-carousel ругается: 400 + русский тост.
10. ✅ Кросс-браузер: Chrome + Safari + Firefox на проде после деплоя — `navigator.clipboard.writeText` работает.

Если какой-то пункт красный — фиксим и возвращаемся к нему.

**Step 2: Push в оба ремоута**

```bash
git push origin main
git push vercel-deploy main
```

Ожидание:
- `origin` (Railway) запустит бэкенд-деплой.
- `vercel-deploy` (Vercel) запустит фронтенд-деплой.
- Через ~3 минуты Railway применит миграцию (или нужно её прогнать вручную через Supabase MCP — зависит от того, есть ли в Railway автомиграции; чаще нет → лучше прогнать миграцию руками на проде перед пушем бэка).

**Step 3: Прогнать smoke-чеклист на проде**

Те же 10 пунктов, но на `https://ximi4ka.ru` (или какой там прод-URL). Если кросс-браузер локально не проверяли — здесь обязательно.

---

## Reference: Skill-bridges

- @superpowers:executing-plans — execute этот план task-by-task
- @superpowers:systematic-debugging — если что-то ломается, использовать его phase-flow
- @superpowers:verification-before-completion — проверить, что фича реально работает, до коммита «done»

## Принципы, заложенные в план

- **DRY** — переиспользуем существующий `BrandDoc` механизм, не плодим новые таблицы.
- **YAGNI** — нет recipe-движка, нет drag-and-drop, нет автотестов (адаптация под фактический фундамент проекта).
- **TDD (адаптированный)** — каждый step заканчивается verification (typecheck/curl/smoke).
- **Frequent commits** — 7 атомарных коммитов, каждый легко ревью/откатить.
