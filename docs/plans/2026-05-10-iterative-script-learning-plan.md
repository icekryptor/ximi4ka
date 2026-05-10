# Iterative Script-Learning Loop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace Voiceover Studio's Step 4 (Стиль) with an iterative editing loop where Claude analyses operator edits, proposes structured addenda to `brand_docs.style_guide_video` (matching А/С/Э convention), and after operator-approved patterns are applied, offers to regenerate with the updated guide or save the final.

**Architecture:** One new Claude endpoint (`POST /api/claude/edit-with-learning`) that takes the original script + either notes or edited script, returns finalScript + summary + structured patterns. One new voiceover endpoint (`POST /api/voiceover/extend-guide`) that UPDATEs brand_docs, bumps version, busts the in-memory prompt cache. Frontend StyleStep is restructured into edit → review patterns → apply → 3-way fork (edit again / regenerate / save).

**Tech Stack:** Express + TypeORM + @anthropic-ai/sdk on backend. React + TypeScript + Tailwind on frontend. No new dependencies, no DB migrations.

**Design doc:** `docs/plans/2026-05-10-iterative-script-learning-design.md`

**Two-remote deploy:** push to `origin` AND `vercel-deploy`.

---

## Stage 0: Pre-flight

### Task 0.1: Verify clean tree + remotes aligned

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka
git fetch origin --quiet && git fetch vercel-deploy --quiet
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log -1 --format=%H
git log -1 origin/main --format=%H
git log -1 vercel-deploy/main --format=%H
```
Expected: three SHAs match.

---

## Stage 1: Backend — `invalidatePromptCache` + new claude endpoint

### Task 1.1: Export `invalidatePromptCache` from prompt-cache service

**Files:**
- Modify: `backend/src/services/prompt-cache.ts`

**Step 1: Locate cache state**

```bash
grep -n "let cache\|export" backend/src/services/prompt-cache.ts
```

There's a module-private `let cache: PromptCache | null = null` (or similar). Below the existing exports, add:

```ts
export function invalidatePromptCache(): void {
  cache = null
}
```

This sets the cache to null. Next `getPromptCache()` call will fall through to the DB load.

**Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
```
Expected: empty.

**Step 3: Commit**

```bash
git add backend/src/services/prompt-cache.ts
git commit -m "feat(voiceover): export invalidatePromptCache from prompt-cache

Allows controllers to bust the in-memory brand_docs cache after
UPDATE-ing the guide (extend-guide endpoint will use this). Without
this, the next Claude generation would still use the stale guide
until the 30-min TTL expires."
```

### Task 1.2: Add `editWithLearning` to claude.controller

**Files:**
- Modify: `backend/src/controllers/claude.controller.ts`

**Step 1: Locate insertion point**

```bash
grep -n "async edit\|async preprocess" backend/src/controllers/claude.controller.ts
```

Insert the new method between `edit` and `preprocess`.

**Step 2: Add method**

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
        parsed = {
          finalScript: editedScript ?? originalScript,
          summary: raw.slice(0, 200),
          patterns: [],
        }
      }
      res.json(parsed)
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка обучения на правках')
    }
  },
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
git add backend/src/controllers/claude.controller.ts
git commit -m "feat(voiceover): claude.editWithLearning — analyze edits + propose addenda

One-shot endpoint that does both: applies the operator's edit (either
free-form notes or an already-edited script) AND extracts semantic
patterns suitable for appending to brand_docs.style_guide_video.

System prompt walks Claude through:
- Use editedScript as new version if provided, else apply notes
- Analyze the diff (semantic, not textual)
- Output structured patterns matching А/С/Э convention from v1.4 guide
- Refuse to invent patterns ('лучше 0 чем мусор')
- Skip trivial edits

Returns {finalScript, summary, patterns: [{code, title, before, after, rationale}]}.
Fallback: if JSON parse fails, treat as plain edit with 0 patterns."
```

### Task 1.3: Wire `/api/claude/edit-with-learning` route

**Files:**
- Modify: `backend/src/routes/claude.routes.ts`

**Step 1: Add route**

```bash
grep -n "edit\|preprocess" backend/src/routes/claude.routes.ts
```

Add a new line after the existing `edit` route:

```ts
router.post('/edit-with-learning', claudeController.editWithLearning)
```

**Step 2: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
git add backend/src/routes/claude.routes.ts
git commit -m "feat(voiceover): mount POST /api/claude/edit-with-learning"
```

---

## Stage 2: Backend — `extendGuide` + cache refresh endpoints

### Task 2.1: Add `extendGuide` to voiceover.controller

**Files:**
- Modify: `backend/src/controllers/voiceover.controller.ts`

**Step 1: Add import for invalidator**

At the top of the file, near other imports:

```ts
import { invalidatePromptCache } from '../services/prompt-cache'
```

Check the existing imports — `getPromptCache` should already be imported via the same module. If so, change to a combined import:

```ts
import { getPromptCache, invalidatePromptCache } from '../services/prompt-cache'
```

**Step 2: Add `extendGuide` method**

After `bootstrap` method (and before the closing `}` of the controller object):

```ts
  async extendGuide(req: Request, res: Response) {
    try {
      const { addenda } = req.body as {
        addenda?: Array<{
          code: string
          title: string
          before?: string
          after?: string
          rationale: string
        }>
      }
      if (!addenda || !Array.isArray(addenda) || addenda.length === 0) {
        return res.status(400).json({ error: 'Поле addenda обязательно (непустой массив)' })
      }

      const docRepo = AppDataSource.getRepository(BrandDoc)
      const doc = await docRepo.findOne({ where: { slug: 'style_guide_video' } })
      if (!doc) return res.status(404).json({ error: 'style_guide_video не найден' })

      // Build markdown block matching v1.4 convention
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

      // Bump version: 1.4 → 1.5; if non-numeric, append timestamp
      const currentVersion = doc.version ?? '1.0'
      const m = currentVersion.match(/^(\d+)\.(\d+)$/)
      const newVersion = m
        ? `${m[1]}.${parseInt(m[2], 10) + 1}`
        : `${currentVersion}+${Date.now()}`

      doc.content = newContent
      doc.version = newVersion
      await docRepo.save(doc)
      invalidatePromptCache()

      res.json({ version: newVersion, addendaCount: addenda.length })
    } catch (e: any) {
      console.error('extend-guide error:', e?.message || e)
      res.status(500).json({ error: 'Не удалось обновить гайд' })
    }
  },

  async refreshCache(_req: Request, res: Response) {
    invalidatePromptCache()
    res.json({ ok: true })
  },
```

If `BrandDoc` is not yet imported — add to the top:
```ts
import { BrandDoc } from '../entities/BrandDoc'
```

**Step 3: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
git add backend/src/controllers/voiceover.controller.ts
git commit -m "feat(voiceover): extendGuide + refreshCache controllers

extendGuide:
- Takes {addenda: [{code, title, before?, after?, rationale}]}
- Appends a timestamped markdown block to brand_docs.style_guide_video.content
  matching the v1.4 ## ✏️ Дополнения convention
- Bumps version (1.4 → 1.5; non-numeric → append timestamp)
- Calls invalidatePromptCache so the next Claude generation picks up
  the new guide immediately (no 30-min TTL wait)

refreshCache: manual nuclear option that just invalidates the cache."
```

### Task 2.2: Wire 2 new voiceover routes

**Files:**
- Modify: `backend/src/routes/voiceover.routes.ts`

**Step 1: Add routes**

After the existing `bootstrap` route:

```ts
router.post('/extend-guide', voiceoverController.extendGuide)
router.post('/cache/refresh', voiceoverController.refreshCache)
```

**Step 2: Typecheck + commit**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "bank-parsers\|telegram\|node-cron\|xlsx\|node-telegram"
git add backend/src/routes/voiceover.routes.ts
git commit -m "feat(voiceover): mount /api/voiceover/extend-guide + /cache/refresh routes"
```

---

## Stage 3: Frontend — API wrapper + Pattern type

### Task 3.1: Add Pattern interface + 3 new methods to voiceover API

**Files:**
- Modify: `frontend/src/api/voiceover.ts`

**Step 1: Add Pattern interface near the top (near FactcheckItem)**

```ts
export interface Pattern {
  code: string
  title: string
  before?: string
  after?: string
  rationale: string
}
```

**Step 2: Add 3 new methods to `voiceoverApi` object**

After the existing `preprocess` method:

```ts
  editWithLearning: async (params: {
    originalScript: string
    notes?: string
    editedScript?: string
  }): Promise<{ finalScript: string; summary: string; patterns: Pattern[] }> => {
    const r = await apiClient.post<{
      finalScript: string
      summary: string
      patterns: Pattern[]
    }>('/claude/edit-with-learning', params)
    return r.data
  },

  extendGuide: async (
    addenda: Pattern[],
  ): Promise<{ version: string; addendaCount: number }> => {
    const r = await apiClient.post<{ version: string; addendaCount: number }>(
      '/voiceover/extend-guide',
      { addenda },
    )
    return r.data
  },

  refreshCache: async (): Promise<{ ok: true }> => {
    const r = await apiClient.post<{ ok: true }>('/voiceover/cache/refresh')
    return r.data
  },
```

**Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
git add frontend/src/api/voiceover.ts
git commit -m "feat(voiceover): API wrapper for edit-with-learning + extend-guide + cache/refresh

Pattern interface mirrors the backend's addenda shape. Three methods
expose the new endpoints to the frontend StyleStep refactor."
```

---

## Stage 4: Frontend — WizardState additions

### Task 4.1: Extend WizardState in VoiceoverStudio

**Files:**
- Modify: `frontend/src/pages/VoiceoverStudio.tsx`

**Step 1: Find WizardState interface and INITIAL**

```bash
grep -n "WizardState\|INITIAL" frontend/src/pages/VoiceoverStudio.tsx
```

**Step 2: Add 4 new fields to the interface**

Inside `WizardState`, before the closing brace:

```ts
  iteration: number
  patterns: Pattern[]
  patternsApproved: boolean[]
  editSummary: string
```

And add the `Pattern` type to the existing import from `../api/voiceover`:

```ts
import { voiceoverApi, BootstrapResponse, FactcheckItem, Pattern } from '../api/voiceover'
```

**Step 3: Update INITIAL constant**

```ts
  iteration: 1,
  patterns: [],
  patternsApproved: [],
  editSummary: '',
```

**Step 4: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
git add frontend/src/pages/VoiceoverStudio.tsx
git commit -m "feat(voiceover): WizardState gets iteration + patterns + editSummary

Prep for StyleStep refactor — state lives in the parent wizard so
moving between steps preserves the iteration counter and any
unapplied patterns from a previous edit pass."
```

---

## Stage 5: Frontend — StyleStep refactor

### Task 5.1: Replace StyleStep with new iterative editor

**Files:**
- Modify: `frontend/src/components/voiceover/StyleStep.tsx`

This is the major piece. Replace the entire file contents:

```tsx
import { useState } from 'react'
import { Loader2, Plus, Check, X, RefreshCw, Save, RotateCcw } from 'lucide-react'
import { voiceoverApi, Pattern } from '../../api/voiceover'
import { unitsApi } from '../../api/contentBank'
import { useToast } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { WizardState } from '../../pages/VoiceoverStudio'

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
  onRegenerate: () => void  // jumps back to step='generate'
}

export function StyleStep({ state, update, onBack, onNext, onRegenerate }: Props) {
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const [notes, setNotes] = useState('')
  const [running, setRunning] = useState(false)
  const [applyingGuide, setApplyingGuide] = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)

  // Has the operator applied patterns in this iteration? Reset on every new edit pass.
  const [guideApplied, setGuideApplied] = useState(false)

  const hasPatterns = state.patterns.length > 0
  const approvedCount = state.patternsApproved.filter(Boolean).length

  const applyEditAndExtract = async () => {
    if (!notes.trim() && state.finalScript === state.draft) {
      toast.error('Внеси правки в текст или опиши их в заметках')
      return
    }
    setRunning(true)
    setGuideApplied(false)
    try {
      const r = await voiceoverApi.editWithLearning({
        originalScript: state.draft,
        notes: notes.trim() || undefined,
        editedScript:
          state.finalScript !== state.draft ? state.finalScript : undefined,
      })
      update({
        finalScript: r.finalScript,
        editSummary: r.summary,
        patterns: r.patterns,
        patternsApproved: r.patterns.map(() => true),  // all approved by default
      })
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Ошибка обучения на правках')
    } finally {
      setRunning(false)
    }
  }

  const togglePattern = (idx: number) => {
    const next = [...state.patternsApproved]
    next[idx] = !next[idx]
    update({ patternsApproved: next })
  }

  const editPattern = (idx: number, key: keyof Pattern, value: string) => {
    const next = [...state.patterns]
    next[idx] = { ...next[idx], [key]: value }
    update({ patterns: next })
  }

  const applyGuideAddenda = async () => {
    const approved = state.patterns.filter((_, i) => state.patternsApproved[i])
    if (approved.length === 0) {
      // Nothing to apply, but operator still wants to continue — skip
      setGuideApplied(true)
      return
    }
    setApplyingGuide(true)
    try {
      const r = await voiceoverApi.extendGuide(approved)
      toast.success(`Гайд обновлён до версии ${r.version}`)
      setGuideApplied(true)
    } catch {
      toast.error('Не удалось обновить гайд')
    } finally {
      setApplyingGuide(false)
    }
  }

  const startAnotherIteration = () => {
    update({
      iteration: state.iteration + 1,
      patterns: [],
      patternsApproved: [],
      editSummary: '',
      // draft becomes the previous finalScript for the next diff
      draft: state.finalScript,
    })
    setNotes('')
    setGuideApplied(false)
  }

  const regenerateWithUpdatedGuide = async () => {
    const ok = await confirm({
      title: 'Перегенерировать?',
      message:
        'Сценарий будет сгенерирован заново с обновлённым гайдом. Текущая версия пропадёт.',
      variant: 'danger',
      confirmText: 'Перегенерировать',
    })
    if (!ok) return
    // Reset iteration counter — we're starting a new generation cycle
    update({
      iteration: 1,
      patterns: [],
      patternsApproved: [],
      editSummary: '',
      draft: '',
      finalScript: '',
    })
    onRegenerate()
  }

  const saveAndContinue = async () => {
    if (!state.unit) return onNext()
    const existing = state.unit.script_text ?? ''
    if (existing && existing.trim() !== state.finalScript.trim()) {
      const ok = await confirm({
        title: 'Перезаписать сценарий?',
        message: 'В юните уже сохранён сценарий. Перезаписать новым из студии?',
        variant: 'danger',
        confirmText: 'Перезаписать',
      })
      if (!ok) return
    }
    setSavingFinal(true)
    try {
      await unitsApi.update(state.unit.id, { script_text: state.finalScript })
      onNext()
    } catch {
      toast.error('Не удалось сохранить сценарий')
    } finally {
      setSavingFinal(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-text">Редактирование</h2>
          <p className="text-sm text-brand-text-secondary mt-1">
            Внеси правки или опиши их в заметках. Claude извлечёт паттерны и предложит дополнения к гайду.
          </p>
        </div>
        <span className="text-xs font-mono text-brand-text-secondary bg-subtle px-2 py-1 rounded">
          Итерация {state.iteration}
        </span>
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
          Сценарий (можно редактировать прямо здесь)
        </label>
        <textarea
          value={state.finalScript}
          onChange={(e) => update({ finalScript: e.target.value })}
          rows={16}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-subtle text-brand-text outline-none focus:border-primary-400 resize-y font-mono text-sm whitespace-pre-line"
        />
      </div>

      <div>
        <label className="text-xs text-brand-text-secondary uppercase tracking-wider">
          Заметки (опционально — если объяснить правки проще словами)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Например: убрать пафос в финале, заменить «огромный» на конкретное число, перенести шутку выше"
          className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-border bg-card text-brand-text outline-none focus:border-primary-400 resize-y text-sm"
        />
      </div>

      <button
        onClick={applyEditAndExtract}
        disabled={running}
        className="btn btn-primary"
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{' '}
        Применить правки и извлечь паттерны
      </button>

      {hasPatterns && (
        <div className="space-y-3 border-t border-brand-border pt-4">
          {state.editSummary && (
            <div className="text-sm text-brand-text-secondary italic">
              {state.editSummary}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-brand-text mb-2">
              Предложенные дополнения к гайду ({approvedCount}/{state.patterns.length})
            </h3>
            <ul className="space-y-2">
              {state.patterns.map((p, i) => {
                const approved = state.patternsApproved[i]
                return (
                  <li
                    key={i}
                    className={`rounded-xl border p-3 transition-colors ${
                      approved
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-subtle border-brand-border opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => togglePattern(i)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                          approved
                            ? 'bg-primary-500 text-white'
                            : 'bg-card border border-brand-border text-brand-text-secondary'
                        }`}
                      >
                        {approved ? <Check size={12} /> : <X size={12} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={p.code}
                            onChange={(e) => editPattern(i, 'code', e.target.value)}
                            className="font-mono text-xs px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent w-12"
                          />
                          <input
                            type="text"
                            value={p.title}
                            onChange={(e) => editPattern(i, 'title', e.target.value)}
                            className="flex-1 text-sm font-semibold px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                          />
                        </div>
                        {p.before !== undefined && (
                          <div className="text-xs text-red-700 mb-0.5">
                            ❌{' '}
                            <input
                              type="text"
                              value={p.before}
                              onChange={(e) => editPattern(i, 'before', e.target.value)}
                              className="w-[calc(100%-1.5rem)] px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                            />
                          </div>
                        )}
                        {p.after !== undefined && (
                          <div className="text-xs text-green-700 mb-1">
                            ✅{' '}
                            <input
                              type="text"
                              value={p.after}
                              onChange={(e) => editPattern(i, 'after', e.target.value)}
                              className="w-[calc(100%-1.5rem)] px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent"
                            />
                          </div>
                        )}
                        <textarea
                          value={p.rationale}
                          onChange={(e) => editPattern(i, 'rationale', e.target.value)}
                          rows={2}
                          className="w-full text-xs text-brand-text-secondary px-1 py-0.5 rounded border border-transparent hover:border-brand-border focus:border-primary-400 outline-none bg-transparent resize-y"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {!guideApplied && (
            <button
              onClick={applyGuideAddenda}
              disabled={applyingGuide}
              className="btn btn-primary text-sm"
            >
              {applyingGuide ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{' '}
              Применить {approvedCount} дополнений к гайду
            </button>
          )}

          {guideApplied && (
            <div className="space-y-2 pt-3 border-t border-brand-border">
              <p className="text-sm text-green-700 font-medium">
                ✓ Гайд обновлён. Что делаем дальше?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={startAnotherIteration}
                  className="btn btn-secondary text-sm"
                >
                  <RotateCcw size={14} /> Ещё правка
                </button>
                <button
                  onClick={regenerateWithUpdatedGuide}
                  className="btn btn-secondary text-sm"
                >
                  <RefreshCw size={14} /> Перегенерировать
                </button>
                <button
                  onClick={saveAndContinue}
                  disabled={savingFinal}
                  className="btn btn-primary text-sm"
                >
                  {savingFinal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
                  Сохранить как финал →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasPatterns && (
        <div className="flex items-center justify-between pt-4 border-t border-brand-border">
          <button onClick={onBack} className="btn btn-secondary">← К фактчеку</button>
          <button
            onClick={saveAndContinue}
            disabled={savingFinal || !state.finalScript.trim()}
            className="btn btn-primary"
          >
            {savingFinal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
            Сохранить и продолжить →
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
```
Expected: empty.

**Note**: this component now needs a new `onRegenerate` prop from the parent. We'll wire it in Task 5.2.

**Step 3: Commit**

```bash
git add frontend/src/components/voiceover/StyleStep.tsx
git commit -m "feat(voiceover): StyleStep — iterative editing loop with pattern extraction

Replaces the old one-shot style filter. New flow:

1. Operator sees finalScript (editable) and notes textarea.
2. Click 'Применить правки и извлечь паттерны' — Claude does both:
   produces new script + identifies semantic patterns matching А/С/Э
   convention. Patterns auto-approved by default.

3. Operator reviews each pattern card with inline editing of code/
   title/before/after/rationale. Checkbox toggles approval.

4. Click 'Применить N дополнений' — sends approved patterns to
   /api/voiceover/extend-guide. Backend UPDATEs brand_docs, bumps
   version, busts cache.

5. Three forks: «↺ Ещё правка» (stay in step, increment iteration),
   «🔄 Перегенерировать» (jump back to Step 2 with updated guide),
   «💾 Сохранить как финал» (save script_text and go to preprocess).

Iteration badge tracks rounds. Empty-patterns case shows direct
'Сохранить и продолжить' button (no learning needed)."
```

### Task 5.2: Wire `onRegenerate` prop in VoiceoverStudio parent

**Files:**
- Modify: `frontend/src/pages/VoiceoverStudio.tsx`

**Step 1: Find StyleStep usage**

```bash
grep -n "StyleStep" frontend/src/pages/VoiceoverStudio.tsx
```

**Step 2: Add `onRegenerate` prop**

Find the `<StyleStep .../>` JSX. Add:

```tsx
onRegenerate={() => update({ step: 'generate' })}
```

The full usage should look like:

```tsx
{state.step === 'style' && (
  <StyleStep
    state={state}
    update={update}
    onBack={() => update({ step: 'factcheck' })}
    onNext={() => update({ step: 'preprocess' })}
    onRegenerate={() => update({ step: 'generate' })}
  />
)}
```

**Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "Cashflow\|Planning\|xlsx\|@dnd-kit"
git add frontend/src/pages/VoiceoverStudio.tsx
git commit -m "feat(voiceover): wire onRegenerate prop in StyleStep usage

When operator picks 'Перегенерировать с обновлённым гайдом' inside
the new iterative StyleStep, the wizard jumps back to step='generate'.
The state has already been reset by StyleStep itself."
```

---

## Stage 6: Push + smoke

### Task 6.1: Verify all commits

```bash
git status -s | grep -v "^??" | grep -v "launch.json\|^ M CLAUDE"
git log --oneline -10
```

### Task 6.2: Push to both remotes

```bash
git push origin main
git push vercel-deploy main
```

### Task 6.3: Confirm deploys

- **Backend (Railway):** confirm latest deploy. No new env vars.
- **Frontend (Vercel):** poll for `state: "READY"`.

### Task 6.4: Smoke checklist

Open `https://erp.ximi4ka.ru/voiceover`, pick a unit, run wizard through Step 2 (Generate) and Step 3 (Factcheck), then in Step 4 (Стиль / Редактирование):

1. **Header:** «Редактирование» + «Итерация 1» badge на правой стороне.
2. **Scenario textarea:** показан `draft` (из Step 2), редактируемый.
3. **Notes textarea:** пустой, плейсхолдер с примером.
4. **Click «Применить правки и извлечь паттерны»** (без правок) → toast «Внеси правки в текст или опиши их в заметках».
5. **Внеси простую правку в notes** (например «убери первую строку») → клик «Применить» → loader → через 10-30s появляется:
   - Резюме правок (1-2 предложения)
   - 0-N карточек паттернов (зависит от того, считает ли Claude правку «паттерном»)
   - Финальный сценарий обновлён
6. **Если паттернов 0:** кнопка «Сохранить и продолжить» сразу — путь как раньше.
7. **Если паттернов ≥1:**
   - Каждая карточка с кодом (А11/Э8/...), title, ❌/✅, rationale
   - Все по умолчанию отмечены (✓)
   - Клик на checkbox — снимает / возвращает
   - Можно править inline каждое поле
8. **«Применить N дополнений к гайду»** → toast «Гайд обновлён до версии 1.5» (или какая там +1).
9. **Появляются 3 кнопки:** «↺ Ещё правка» / «🔄 Перегенерировать» / «💾 Сохранить как финал».
10. **«↺ Ещё правка»** — счётчик «Итерация 2», паттерны очищены, draft = previous finalScript.
11. **«🔄 Перегенерировать»** — confirm dialog → подтверждение → возврат на Step 2 (Generate). Iteration сбрасывается до 1, draft пустой.
12. **«💾 Сохранить как финал»** — confirm если был старый script_text → UPDATE → Step 5 (Preprocess).
13. **DB verification:** в Supabase Studio открой `brand_docs WHERE slug='style_guide_video'` → `content` должен заканчиваться новым `## ✏️ Дополнения от оператора (2026-05-10)` блоком, `version` = 1.5.
14. **Regression: Step 5 preprocess** — должен подхватить обновлённый гайд при необходимости (косвенно, через `getPromptCache` после `invalidatePromptCache`).
15. **Regression: Step 4 без правок** — кнопка «Сохранить и продолжить» по-прежнему работает (без обучения).

Если что-то отвалится — Systematic-Debugging skill.

---

## Out of scope / future work

- UI-редактор всех 4 brand_docs slug-ов (style_guide / style_guide_video / rubrics_matrix / session_start_prompt) — отдельная задача.
- Versioned history гайда с rollback per addendum — сейчас только textual append.
- Diff-визуализация — highlight added/removed lines в обоих textareas.
- Pattern deduplication / merge с существующими дополнениями.
- Категориальная группировка нового addenda-блока (А-блок, С-блок, Э-блок раздельно).
- Backend valid-codes check (нельзя создать «А11» если в гайде уже «А12»).
- Подсветка iteration count в Content Engine dashboard.

---

## Rollback

1. **Frontend:** redeploy предыдущий `vercel-deploy` коммит — старый StyleStep вернётся.
2. **Backend:** `git revert` коммитов из Stage 1-2.
3. **Guide cleanup в БД:** если несколько ложных дополнений уже залились, найти timestamp в content и удалить блок руками через Supabase Studio SQL. Версия не сбрасывается автоматически — поставить вручную если нужно.
4. **No DB migrations** — нечего откатывать.
