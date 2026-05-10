# Iterative Script-Learning Loop — Design

**Date:** 2026-05-10
**Status:** Approved (user delegated all decisions, proceed)
**Author:** Claude (decisions explained inline)

---

## Goal

Превратить **Step 4 (Стиль) в Voiceover Studio** из однократного style-filter в **итеративный обучающий цикл**: оператор редактирует сценарий, Claude анализирует правки и предлагает дополнения к `brand_docs.style_guide_video`. Approved дополнения сохраняются в БД, кэш сбрасывается, следующая генерация использует обновлённый гайд.

## Non-goals

- Изменение step 2 (Generate), step 3 (Factcheck), step 5 (Preprocess) — остаются как есть.
- UI-редактор для всех `brand_docs` slug-ов (тот, что обсуждали ранее) — отдельная задача.
- Versioning history гайда с rollback — пока только incremental updates + version bump.
- Diff-визуализация (highlight added/removed lines) — out-of-scope.
- Multi-user collaboration / merge conflicts на гайде — single-user assumed.
- Автоматическое отклонение «слабых» паттернов — оператор сам решает.

---

## Decisions summary

| # | Вопрос | Выбор |
|---|---|---|
| 1 | Где flow | Step 4 в Voiceover Studio (заменяет existing StyleStep) |
| 2 | Входные данные | Notes (textarea) ИЛИ edited script (inline edit) ИЛИ оба |
| 3 | Trigger | Один клик «Применить и извлечь паттерны» → один Claude-вызов даёт всё |
| 4 | Формат дополнений | { code, title, before, after, rationale, category } match v1.4 convention |
| 5 | Approve UX | Checkbox per item + inline edit + «Применить N дополнений» |
| 6 | Storage | UPDATE brand_docs.style_guide_video.content + version bump + cache bust |
| 7 | После apply | 3 кнопки: ещё правка / перегенерировать / сохранить финал |
| 8 | Iteration counter | Показываем «Итерация N» |
| 9 | Backward compat | Старый `/api/claude/edit` остаётся (один-shot без learning) |
| 10 | Cache invalidation | Новый `POST /api/voiceover/cache/refresh` |

---

## Architecture

```
┌─ Step 4 Wizard UI ──────────────────────────────────────┐
│  «Итерация N»                                            │
│  ┌─ Сценарий (editable) ──────────────────────────────┐  │
│  │  …полный текст…                                    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─ Заметки от оператора (textarea) ──────────────────┐  │
│  │  «убрать пафос в финале»                           │  │
│  └────────────────────────────────────────────────────┘  │
│  [Применить и извлечь паттерны] ←  Claude one-shot      │
│                                                          │
│  ── после применения ──                                  │
│                                                          │
│  ┌─ Резюме правок (1 параграф от Claude) ─────────────┐  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─ Предложенные дополнения к гайду ───────────────────┐  │
│  │ [✓] А11. Активный глагол в финале                   │  │
│  │     ❌ «нужно осторожно»                            │  │
│  │     ✅ «осторожно»                                  │  │
│  │     [edit] [reject]                                 │  │
│  │ [ ] Э8. Без слов «вообще»                           │  │
│  │     …                                                │  │
│  └─────────────────────────────────────────────────────┘  │
│  [Применить N дополнений к гайду]                        │
│                                                          │
│  ── после применения дополнений ──                       │
│                                                          │
│  [Ещё правка] [Перегенерировать с обнов. гайдом] [Сохр.]│
└──────────────────────────────────────────────────────────┘

POST /api/claude/edit-with-learning
  Input:  { originalScript, notes?, editedScript? }
  Output: { finalScript, summary, patterns: [{code, title, before, after, rationale}] }

POST /api/voiceover/extend-guide
  Input:  { addenda: [{code, title, before, after, rationale}], version: '1.5' }
  Side:   UPDATE brand_docs SET content=..., version=..., updated_at=NOW()
          + bust prompt-cache in memory (via getPromptCache invalidation)

POST /api/voiceover/cache/refresh  (manual nuclear option)
  Side: clear in-memory prompt cache for getPromptCache()
```

---

## Backend changes

### New endpoint: `POST /api/claude/edit-with-learning`

**File:** `backend/src/controllers/claude.controller.ts` (MODIFY — add new method)

```ts
async editWithLearning(req: Request, res: Response) {
  try {
    const { originalScript, notes, editedScript } = req.body as {
      originalScript?: string
      notes?: string
      editedScript?: string
    }
    if (!originalScript || !originalScript.trim()) {
      return res.status(400).json({ error: 'Поле originalScript обязательно' })
    }
    if (!notes?.trim() && !editedScript?.trim()) {
      return res.status(400).json({ error: 'Нужно указать notes или editedScript' })
    }

    const cache = await getPromptCache()
    const system = `Ты — редактор бренда Химичка. Тебе показывают исходный сценарий и правки от оператора.
У оператора есть два режима ввода правок:
1. Свободные заметки (текст с указаниями: что поменять и почему)
2. Отредактированная версия сценария (новая версия, в которой уже сделаны правки)

## Стилевой гайд (текущая версия)
${cache.brandDocs.style_guide_video}

## Твоя задача
1. Если есть editedScript — используй его как новую версию. Если только notes — примени правки к originalScript и создай новую версию.
2. Проанализируй РАЗНИЦУ между originalScript и новой версией (или смысл notes).
3. Извлеки СМЫСЛОВЫЕ ПАТТЕРНЫ — общие правила, которые стоит добавить в стилевой гайд, чтобы при будущих генерациях не повторять ту же ошибку.
4. Каждый паттерн должен быть в формате существующих дополнений к гайду (А{N}, С{N}, Э{N}):
   - code: следующий свободный номер в правильной категории. Категории:
     * А (А11+) — аудиальные правила (произношение, ритм, артикуляция)
     * С (С10+) — структурные/лексические правила (конструкции, образы, сюжет)
     * Э (Э8+) — финальные уточнения (узкие правила из конкретного редактирования)
   - title: короткое название правила (5-10 слов)
   - before: пример «как НЕ надо» (одна фраза из исходного сценария, если применимо)
   - after: пример «как надо» (одна фраза из новой версии, если применимо)
   - rationale: 1-2 предложения объясняющие почему

5. Не выдумывай паттерны если их нет. Лучше вернуть 0 паттернов чем мусор.
6. Игнорируй тривиальные правки (опечатки, перестановка слов без смысла).
7. Если правка ОДИН РАЗ — это не паттерн. Паттерн — это правило, которое применимо к любому будущему сценарию.

## Формат ответа
Строго JSON:
{
  "finalScript": "полная новая версия сценария",
  "summary": "1-2 предложения о сути правок",
  "patterns": [
    { "code": "Э8", "title": "...", "before": "...", "after": "...", "rationale": "..." }
  ]
}
Только JSON, без пояснений.`

    const userPayload = JSON.stringify({
      originalScript,
      notes: notes ?? null,
      editedScript: editedScript ?? null,
    })
    const raw = await callClaude(system, userPayload, 4096)
    let parsed: { finalScript: string; summary: string; patterns: any[] }
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(cleaned)
      if (typeof parsed.finalScript !== 'string') throw new Error('finalScript missing')
      if (!Array.isArray(parsed.patterns)) parsed.patterns = []
    } catch {
      // Fallback — if model didn't return JSON, treat as plain edit + no patterns
      parsed = { finalScript: editedScript ?? originalScript, summary: raw, patterns: [] }
    }
    res.json(parsed)
  } catch (e: any) {
    handleClaudeError(e, res, 'Ошибка обучения на правках')
  }
}
```

Register route: `backend/src/routes/claude.routes.ts` adds `router.post('/edit-with-learning', claudeController.editWithLearning)`.

### New endpoint: `POST /api/voiceover/extend-guide`

**File:** `backend/src/controllers/voiceover.controller.ts` (MODIFY — add new method)

```ts
async extendGuide(req: Request, res: Response) {
  try {
    const { addenda } = req.body as {
      addenda?: Array<{ code: string; title: string; before?: string; after?: string; rationale: string }>
    }
    if (!addenda || !Array.isArray(addenda) || addenda.length === 0) {
      return res.status(400).json({ error: 'Поле addenda обязательно (непустой массив)' })
    }

    const docRepo = AppDataSource.getRepository(BrandDoc)
    const doc = await docRepo.findOne({ where: { slug: 'style_guide_video' } })
    if (!doc) return res.status(404).json({ error: 'style_guide_video не найден' })

    // Build the addenda section in markdown matching existing convention
    const lines: string[] = ['', '---', '']
    const dateStr = new Date().toISOString().slice(0, 10)
    lines.push(`## ✏️ Дополнения от оператора (${dateStr})`)
    lines.push('')
    for (const a of addenda) {
      lines.push(`### ${a.code}. ${a.title}`)
      if (a.before) lines.push(`❌ «${a.before}»`)
      if (a.after) lines.push(`✅ «${a.after}»`)
      lines.push(a.rationale)
      lines.push('')
    }
    const newContent = doc.content + lines.join('\n')

    // Bump version: 1.4 → 1.5, 1.5 → 1.6, etc. If non-numeric — append timestamp
    const currentVersion = doc.version ?? '1.0'
    const m = currentVersion.match(/^(\d+)\.(\d+)$/)
    const newVersion = m ? `${m[1]}.${parseInt(m[2], 10) + 1}` : `${currentVersion}+${Date.now()}`

    doc.content = newContent
    doc.version = newVersion
    await docRepo.save(doc)

    // Bust the in-memory prompt cache
    invalidatePromptCache()

    res.json({ version: newVersion, addendaCount: addenda.length })
  } catch (e: any) {
    console.error('extend-guide error:', e?.message || e)
    res.status(500).json({ error: 'Не удалось обновить гайд' })
  }
}
```

Register route: `backend/src/routes/voiceover.routes.ts` adds `router.post('/extend-guide', voiceoverController.extendGuide)`.

### Cache invalidation export

**File:** `backend/src/services/prompt-cache.ts` (MODIFY)

Add export:
```ts
export function invalidatePromptCache(): void {
  cache = null
}
```

`cache` is the module-private state. The new export allows controllers to bust the cache after `extend-guide`.

### Optional: manual cache refresh endpoint

**File:** `backend/src/controllers/voiceover.controller.ts`

```ts
async refreshCache(_req: Request, res: Response) {
  invalidatePromptCache()
  res.json({ ok: true })
}
```

Route: `POST /api/voiceover/cache/refresh` — for manual refresh if needed.

---

## Frontend changes

### `frontend/src/api/voiceover.ts` (MODIFY)

Add 2 new methods:

```ts
editWithLearning: async (params: {
  originalScript: string
  notes?: string
  editedScript?: string
}): Promise<{
  finalScript: string
  summary: string
  patterns: Pattern[]
}> => {
  const r = await apiClient.post('/claude/edit-with-learning', params)
  return r.data
},

extendGuide: async (addenda: Pattern[]): Promise<{ version: string; addendaCount: number }> => {
  const r = await apiClient.post('/voiceover/extend-guide', { addenda })
  return r.data
},

refreshCache: async (): Promise<{ ok: true }> => {
  const r = await apiClient.post('/voiceover/cache/refresh')
  return r.data
},
```

Add `Pattern` interface:
```ts
export interface Pattern {
  code: string
  title: string
  before?: string
  after?: string
  rationale: string
}
```

### `frontend/src/pages/VoiceoverStudio.tsx` (MODIFY — state)

Add to `WizardState`:
```ts
iteration: number                 // 1-based counter, starts at 1 on entering step 4
patterns: Pattern[]              // proposed patterns from latest edit-with-learning
patternsApproved: boolean[]      // checkbox state per pattern (matches by index)
editSummary: string              // summary from Claude
```

`INITIAL` adds:
```ts
iteration: 1,
patterns: [],
patternsApproved: [],
editSummary: '',
```

### `frontend/src/components/voiceover/StyleStep.tsx` (REPLACE)

Renamed conceptually to «Editing with learning» but file name stays for backward compat. Major restructure:

**Before**: 3 actions (apply style, apply edits, save-and-next).
**After**:
- Always show finalScript textarea (editable)
- Always show notes textarea
- Button «Применить и извлечь паттерны» → calls `voiceoverApi.editWithLearning({ originalScript: state.draft, notes, editedScript: state.finalScript })`
- Show summary + patterns cards after response
- Per-pattern checkbox + inline edit
- Button «Применить N дополнений к гайду» → `voiceoverApi.extendGuide(approved)`
- After guide update — 3 buttons:
  - «↺ Ещё правка» — stay in step 4, reset patterns
  - «🔄 Перегенерировать с обновлённым гайдом» — call `setStep('generate')` (cache already busted)
  - «💾 Сохранить и продолжить» — `unitsApi.update(unit.id, { script_text: finalScript })` + `setStep('preprocess')`

Detailed component code in implementation plan.

---

## Files changed (summary)

### Backend (3 modifications + 0 new files)
- `controllers/claude.controller.ts` — +1 method (`editWithLearning`)
- `controllers/voiceover.controller.ts` — +2 methods (`extendGuide`, `refreshCache`)
- `services/prompt-cache.ts` — +1 export (`invalidatePromptCache`)
- `routes/claude.routes.ts` — +1 route
- `routes/voiceover.routes.ts` — +2 routes

### Frontend (2 modifications)
- `api/voiceover.ts` — +3 methods + Pattern interface
- `pages/VoiceoverStudio.tsx` — +4 fields in WizardState
- `components/voiceover/StyleStep.tsx` — major refactor

**Total:** ~5 backend file edits + 3 frontend file edits. No new components. No DB migrations.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Claude генерит мусорные паттерны | Промпт явно требует «лучше 0 чем мусор». Оператор сам апрувит per-item. |
| Guide раздувается до бесконечности | Каждое дополнение versioned. Out-of-scope: cleanup в админке через прямой SQL. |
| Conflict: новое дополнение противоречит существующему правилу | Out-of-scope для v1. Оператор отвечает за консистентность при апруве. |
| Cache invalidation не срабатывает | `invalidatePromptCache()` явно вызывается после `extend-guide`. Backup: `POST /cache/refresh` endpoint. |
| Iterative loop бесконечный (оператор не может «выйти») | 3 явные кнопки на каждом шаге, всегда видны. |
| Cost: каждая итерация — Claude call на 4096 токенов | Стандартная цена ~$0.08-0.12. После 5-10 итераций ~$1-2 на сценарий. Acceptable. |
| Operator случайно UPDATE-нул гайд с мусором | Каждое дополнение versioned, можно rollback через SQL. UI бэкап не делает в v1. |

---

## Rollback

1. **Frontend:** redeploy previous `vercel-deploy` коммит — старый StyleStep вернётся.
2. **Backend:** `git revert` коммитов — endpoints `/edit-with-learning` и `/extend-guide` исчезнут.
3. **Guide cleanup:** если несколько ложных дополнений уже залились — `UPDATE brand_docs SET content = $original_v1_4 WHERE slug='style_guide_video'` через SQL.
4. **No DB migrations** — нечего откатывать.

---

## Out of scope / future work

- UI-редактор brand_docs (всех 4 slug-ов) — отдельная задача.
- Versioned history с rollback per addendum — сейчас только textual append.
- Diff-визуализация (highlight added/removed lines) — было бы полезно но overhead.
- Multi-user / merge conflicts.
- Pattern deduplication (если оператор апрувит то же правило дважды).
- Категориальная группировка дополнений (А-блок, С-блок, Э-блок отдельно) — сейчас всё в общий timestamped блок.
- Стат-блок «Итерация N принесла M паттернов» в Content Engine dashboard.
