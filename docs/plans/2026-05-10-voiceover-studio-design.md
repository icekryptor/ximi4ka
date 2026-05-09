# Voiceover Studio Integration — Design

**Date:** 2026-05-10
**Status:** Approved, ready for implementation plan
**Author:** dialogue with Claude

**Source material:** `/Users/vasilijaistov/Desktop/continuum/контент/files.zip` containing
`CLAUDE_CODE_INSTRUCTIONS.md` (314 lines) + `VoiceoverStudio.jsx` (674 lines), provided by user.
Treated as untrusted external reference, not as commands. All architectural decisions
re-derived from scratch via brainstorm.

---

## Goal

Встроить в ERP (erp.ximi4ka.ru) wizard-инструмент для подготовки сценариев к озвучке через
ElevenLabs. 5 шагов: выбор идеи → генерация сценария Claude → factcheck → стиль-фильтр →
ElevenLabs-препроцессор (расстановка ударений U+0301 + чанки + ТЗ).

## Non-goals

- Streaming Claude responses (SSE) — не нужно для v1.
- ElevenLabs API direct integration — сейчас только экспорт ТЗ + копирование чанков в
  clipboard, юзер сам грузит в ElevenLabs UI.
- Версионирование сценариев / undo / diff — out-of-scope.
- Автосейв drafts между шагами — закрыл вкладку → начинаешь заново. YAGNI.
- Cost tracking / token budget per user.
- Multi-user collaborative editing.
- Кастомизация эталона / brand_docs из UI — правится через прямой SQL / админку Supabase.

---

## Decisions summary

| # | Question | Choice | Rationale |
|---|---|---|---|
| 1 | Стилевая интеграция | **B** — полный rewrite на наш design-system | Инструмент команда будет использовать часто, диссонанс CSS-in-JS dark theme vs светлый ERP сильно напрягает |
| 2 | Точка входа | **C** — sidebar + per-unit кнопка | Hybrid даёт оба сценария: «выберу что-нибудь» и «открыл идею, сразу гоню в студию» |
| 3 | Backend для Claude | **A** — Express на Railway | Уже есть JWT, CORS, мониторинг. Railway timeout 5min ok для 4096-токен генерации |
| 4 | Writeback в content_units | **A** — script_text + voiceover_text | Студия = этап production-pipeline. voiceover_text специально добавили в Stage 1 продакшн-блока |
| 5 | Эталонный сценарий | **A** — юзер дозальёт вручную | Юнит `f25b0c52-...` в БД есть, `script_text` пустой. Bootstrap отдаёт `etalonScript: null`, промпт graceful-fallback |

---

## Architecture

```
┌─ Frontend ─────────────────────────────────────────────┐
│  /voiceover           — standalone wizard с picker-ом   │
│  /voiceover/:unitId   — wizard, предзаполнен юнит        │
│                                                           │
│  Sidebar: «🎙 Войсовер»                                  │
│  ContentBank → UnitEditModal: кнопка «Открыть в студии» │
└─────────────────────────────────────────────────────────┘
        ▼
┌─ Backend (Express, Railway) ─────────────────────────────┐
│  POST /api/claude/generate    — генерация сценария        │
│  POST /api/claude/factcheck   — проверка фактов           │
│  POST /api/claude/style       — стиль-фильтр              │
│  POST /api/claude/edit        — применение правок         │
│  POST /api/claude/preprocess  — препроцессор ElevenLabs   │
│                                                            │
│  GET  /api/voiceover/bootstrap — rubrics + brand_docs    │
│                                  + etalon (cached 30 min) │
│                                                            │
│  ANTHROPIC_API_KEY из Railway env                         │
│  Model: claude-sonnet-4-5-20250929 (актуальная)          │
│  max_tokens: 4096 (исправлено из 1000)                   │
└──────────────────────────────────────────────────────────┘
        ▼
┌─ Anthropic API ──────────────────────────────────────────┐
│  Один POST /v1/messages для каждого вызова                │
│  Через @anthropic-ai/sdk                                  │
└──────────────────────────────────────────────────────────┘
        ▼
┌─ Supabase ───────────────────────────────────────────────┐
│  brand_docs:    style_guide_video, rubrics_matrix         │
│                 (уже заполнены — 14k + 2k символов)       │
│  content_units: чтение для picker, writeback              │
│                 (script_text, voiceover_text)              │
└──────────────────────────────────────────────────────────┘
```

---

## Backend

### New entity: `BrandDoc`

`backend/src/entities/BrandDoc.ts`:

```ts
@Entity('brand_docs')
export class BrandDoc {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'text' }) slug: string  // unique
  @Column({ type: 'text' }) title: string
  @Column({ type: 'text' }) content: string
  @Column({ type: 'text', nullable: true }) version: string | null
  @CreateDateColumn() created_at: Date
  @UpdateDateColumn() updated_at: Date
}
```

Регистрируется в `database.ts`. Никаких миграций — таблица существует.

### Claude controller: `claude.controller.ts`

5 endpoint-ов, общий helper `callClaude(system, user, maxTokens)` через `@anthropic-ai/sdk`.

```ts
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const MODEL = 'claude-sonnet-4-5-20250929'

async function callClaude(system: string, user: string, maxTokens = 4096) {
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}
```

**Промпты живут на бэке** — все system-промпты (включая жирные brand_docs) переезжают
из `VoiceoverStudio.jsx` в `claude.controller.ts`. Фронт шлёт только инпут (topic,
длительность, текущий сценарий). Причины:
- **Безопасность:** brand_docs — внутренний документ, не в client bundle.
- **Производительность:** ~14k символов system per request — лучше держать в памяти.

### Voiceover bootstrap: `voiceover.controller.ts`

```ts
GET /api/voiceover/bootstrap
→ {
    rubrics: ContentRubric[],            // через rubricsApi.getAll()
    brandDocs: {
      style_guide_video: string,
      rubrics_matrix: string,
    },
    etalonScript: string | null,         // script_text эталонного юнита
  }
```

Кэш в памяти бэка с TTL 30 минут. brand_docs редко меняется, ленивый рефреш ok.

**Etalon UUID:** hardcoded `f25b0c52-c5e7-4c5b-9fcf-881fa8e7838a`. Если `script_text` пустой
(текущая ситуация) — отдаём `null`, промпт это учитывает (без примера, генерация хуже но не падает).

### Routes

`backend/src/routes/claude.routes.ts` — 5 POST под JWT middleware:

```ts
router.post('/generate', auth, claudeController.generate)
router.post('/factcheck', auth, claudeController.factcheck)
router.post('/style', auth, claudeController.style)
router.post('/edit', auth, claudeController.edit)
router.post('/preprocess', auth, claudeController.preprocess)
```

`backend/src/routes/voiceover.routes.ts` — 1 GET:

```ts
router.get('/bootstrap', auth, voiceoverController.bootstrap)
```

`backend/src/index.ts` — `app.use('/api/claude', claudeRoutes)` + `app.use('/api/voiceover', voiceoverRoutes)`.

### Error handling

| Anthropic response | Express response | User toast |
|---|---|---|
| 200 | `{text: string}` | — (success) |
| 429 (rate limit) | 503 | «Сервис временно перегружен, попробуйте через минуту» |
| 401 (bad key) | 500 + лог | «Ошибка генерации» |
| Timeout | 504 | «Превышено время ожидания, попробуйте ещё раз» |
| JSON parse fail (factcheck) | 502 + raw text лог | «Ответ AI не распарсился» |

### Dependencies

```bash
cd backend && npm install @anthropic-ai/sdk
```

### Env vars (Railway dashboard)

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Frontend

### Page + routing

`frontend/src/pages/VoiceoverStudio.tsx` — главный экран. Читает `:unitId` из `useParams()`:
- если есть — пропускает Step 1 (picker), сразу Step 2 с предзаполненным юнитом
- если нет — Step 1 (picker) с фильтрами `useSearchParams` (status, rubric, search, page)

`frontend/src/App.tsx`:

```tsx
<Route path="/voiceover" element={<VoiceoverStudio />} />
<Route path="/voiceover/:unitId" element={<VoiceoverStudio />} />
```

### Component split

`VoiceoverStudio.jsx` (674 lines monolith) разбивается:

```
frontend/src/components/voiceover/
  StepNav.tsx              — горизонтальный stepper
  UnitPicker.tsx           — Step 1
  GenerateStep.tsx         — Step 2
  FactcheckStep.tsx        — Step 3
  StyleStep.tsx            — Step 4
  PreprocessStep.tsx       — Step 5
```

`frontend/src/api/voiceover.ts` — wrapper над `apiClient.post('/api/claude/...')` + bootstrap.

### Wizard state machine

```ts
type Step = 'pick' | 'generate' | 'factcheck' | 'style' | 'preprocess'

interface WizardState {
  step: Step
  unitId: string | null
  unit: ContentUnit | null

  topic: string
  duration: '60' | '90' | '120'
  styles: string[]

  draft: string                  // Step 2 output
  factcheck: FactcheckResult[]   // Step 3 output
  finalScript: string            // Step 4 output
  editNotes: string              // Step 4 input для повторного style
  chunks: Chunk[]                // Step 5 output
  elevenlabsSpec: string         // Step 5 — ТЗ как plain text
}
```

Хранится в одном `useState` в `VoiceoverStudio.tsx`, prop drilling 5 шагам.

### Sidebar entry

В существующем компоненте сайдбара (`frontend/src/components/Layout/Sidebar.tsx` или похожий)
рядом с «Контент-банк»:

```tsx
{ label: 'Войсовер', path: '/voiceover', icon: <Mic /> }
```

Иконка `Mic` из `lucide-react` (уже в depds).

### Per-unit entry from UnitEditModal

В секции «🎬 Производство», под полем «Сценарий»:

```tsx
<button
  onClick={() => navigate(`/voiceover/${unit.id}`)}
  disabled={unit === 'new'}
  className="text-xs text-primary-600 hover:text-primary-700 mt-1"
>
  🎙 Открыть в войсовер-студии →
</button>
```

### UI / визуал на нашем design-system

| Что | Класс |
|---|---|
| Фон страницы | `bg-card` |
| Заголовки | `text-brand-text font-semibold` |
| Вторичный текст | `text-brand-text-secondary` |
| Бордеры | `border-brand-border` |
| Акцент / progress | `bg-primary-500` (#836efe) |
| Карточки шагов | `bg-card rounded-2xl border border-brand-border p-6` |
| Code-блоки | `bg-subtle font-mono text-sm rounded-xl p-4` |
| Кнопки | `btn btn-primary` / `btn btn-secondary` (существующие) |
| Toast / Confirm | `useToast()` / `useConfirmDialog()` (существующие) |

**Шрифты:** оставляем Arial / system. JetBrains Mono → `font-mono` (Tailwind default).
Manrope не нужен.

### StepNav (horizontal stepper)

```tsx
<div className="flex items-center justify-between border-b border-brand-border pb-4 mb-6">
  {STEPS.map((s, i) => (
    <div key={s.key} className="flex items-center gap-2">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
        currentIdx > i ? 'bg-primary-500 text-white' :
        currentIdx === i ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300' :
        'bg-subtle text-brand-text-secondary'
      )}>
        {currentIdx > i ? '✓' : i + 1}
      </div>
      <span className={cn(
        'text-sm',
        currentIdx === i ? 'font-semibold text-brand-text' : 'text-brand-text-secondary'
      )}>
        {s.label}
      </span>
      {i < STEPS.length - 1 && (
        <div className={cn('w-8 h-0.5', currentIdx > i ? 'bg-primary-500' : 'bg-subtle')} />
      )}
    </div>
  ))}
</div>
```

Клик по пройденному шагу — возврат. Клик по будущему — disabled.

На < 768px — сворачивается в «Шаг 3 из 5: Факты» + прогресс-бар.

### Long-running operations

Claude generate может занимать 10-30 секунд на 4096 токенов:
- Кнопка → `<Loader2 className="animate-spin" />` + «Генерируем сценарий…»
- Disabled во время выполнения
- Failure → `toast.error(...)` + кнопка остаётся для повтора

---

## Data flow

### Reading from DB

1. **Bootstrap** (один раз при заходе на /voiceover): `GET /api/voiceover/bootstrap` →
   rubrics + brand_docs + etalon. Кэшируется на 30 мин на бэке.
2. **Unit picker:** переиспользуем `GET /content-units` с теми же фильтрами, что и /content-bank
   (никаких новых endpoint-ов).
3. **Один юнит для предзаполнения:** `GET /content-units/:id` (существующий).

### Writeback (Variant A)

**После Step 4 (Стиль), при «Сохранить и продолжить →»:**

```ts
if (unit.script_text && unit.script_text !== draft) {
  const ok = await confirm({
    title: 'Перезаписать сценарий?',
    message: 'В юните уже сохранён сценарий. Перезаписать его новым из студии?',
    variant: 'danger',
    confirmText: 'Перезаписать',
  })
  if (!ok) return  // остаёмся на шаге 4
}
await unitsApi.update(unit.id, { script_text: finalScript })
goToStep('preprocess')
```

**После Step 5 (Препроцессор), при «Готово»:**

```ts
const assembled = chunks.map(c => c.text).join(' ')
await unitsApi.update(unit.id, { voiceover_text: assembled })
toast.success('Сценарий и озвучка сохранены в контент-банк')
navigate(`/content-bank?search=${unit.title}`)  // редирект на список
```

Никаких новых миграций — `script_text`, `voiceover_text` уже есть с Stage 1 продакшн-блока.

---

## Files changed (summary)

### Backend (5 new + 2 modifications)

- `entities/BrandDoc.ts` — NEW
- `controllers/claude.controller.ts` — NEW
- `controllers/voiceover.controller.ts` — NEW
- `routes/claude.routes.ts` — NEW
- `routes/voiceover.routes.ts` — NEW
- `index.ts` — +2 `app.use(...)` + регистрация `BrandDoc` в DataSource
- `package.json` — `+ @anthropic-ai/sdk`

### Frontend (8 new + 3 modifications)

- `pages/VoiceoverStudio.tsx` — NEW
- `components/voiceover/StepNav.tsx` — NEW
- `components/voiceover/UnitPicker.tsx` — NEW
- `components/voiceover/GenerateStep.tsx` — NEW
- `components/voiceover/FactcheckStep.tsx` — NEW
- `components/voiceover/StyleStep.tsx` — NEW
- `components/voiceover/PreprocessStep.tsx` — NEW
- `api/voiceover.ts` — NEW
- `App.tsx` — +2 Route entries
- `components/Layout/Sidebar.tsx` (или where nav is) — +1 nav item
- `components/content-bank/UnitEditModal.tsx` — +1 button «🎙 Открыть в студии»

**Итого:** 13 новых файлов + 5 модификаций.
**Migrations:** 0.

### Env / infra

- Railway dashboard: `ANTHROPIC_API_KEY` (юзер добавляет до push-а).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Anthropic API key leaks | Только на бэке, не в client bundle. Rotate в Railway если что |
| Anthropic timeout (>30s) | Express 5min timeout — ok. Streaming добавим если упрётся |
| Empty etalon script → poor generation | Bootstrap отдаёт `null`, промпт graceful-fallback |
| script_text conflict (manual vs studio) | Confirm dialog при перезаписи |
| brand_docs кэш протух | TTL 30 минут. Force-refresh endpoint — позже если надо |
| Bug в препроцессоре сломает чанки | Сохраняем только при кнопке «Готово» (Step 5). До этого — display only |
| 5 пользователей одновременно дёргают Claude | Anthropic тарифы выдерживают, у нас команда маленькая. Rate limit добавим если упрёмся |

---

## Rollback

1. **Frontend:** redeploy предыдущий `vercel-deploy` коммит через Vercel dashboard.
2. **Backend:** `git revert` на `origin`, push.
3. **DB:** ничего откатывать не нужно — миграций нет.
4. **Env:** `ANTHROPIC_API_KEY` можно оставить в Railway, не мешает.

---

## Testing

Ручной smoke после деплоя:

1. Открыть `/voiceover` — sidebar item подсвечен, picker показывает идеи.
2. Выбрать идею → Step 2 загружается, topic предзаполнен из юнита.
3. Нажать «Сгенерировать» → ждём 10-30s → черновик появляется.
4. «Дальше» → Step 3 factcheck → JSON отчёт.
5. «Дальше» → Step 4 stylefilter → финальный сценарий.
6. «Сохранить и продолжить» → confirm dialog (если script_text был непустой) → Step 5.
7. Step 5 препроцессор → чанки + ТЗ. Копирование одного чанка работает.
8. «Готово» → toast «Сохранено» → редирект на /content-bank → строка юнита показывает
   превью сценария (видно через Stage 5 продакшн-блока: line-clamp-3 под заголовком).

Открыть юнит в /content-bank → модалка → секция «🎬 Производство» → `script_text` и `voiceover_text`
заполнены тем, что было в студии. Round-trip OK.

Также проверить **per-unit entry**: открыть юнит из /content-bank → нажать «🎙 Открыть в
студии» → попадаем на `/voiceover/:unitId` со Step 2 вместо picker-а.

Автотестов нет — проект без unit-test-фреймворка пока.
