# OKR Visualization Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Лёгкая страница `/marketing/okr` для Понедельник/среда/пятница чек-ин ритуала — текущий квартал, manual-статусы KR-ов, sticky anti-goals bar.

**Architecture:** Frontend-only страница парсит markdown из `brand_docs.okr_2026_2027` через regex-парсер, статусы хранятся JSON-блобом в `brand_docs.okr_status` через существующий `brandDocsApi.upsert`. Никаких backend-изменений, миграций, новых таблиц.

**Tech Stack:** React + TS + Tailwind. Lazy-loaded page mounted via App.tsx route. Nav item via Layout.tsx config. Никаких новых deps.

**Design reference:** `docs/plans/2026-05-23-okr-page-design.md`

**Testing note:** Проект без test runner. Каждая задача завершается typecheck + smoke. Финальный smoke — на проде.

---

## Task 1: OKR markdown parser

**Files:**
- Create: `frontend/src/lib/okr-parser.ts`

**Step 1: Implement**

`frontend/src/lib/okr-parser.ts`:

```typescript
/**
 * OKR markdown parser — extracts structures needed for the OKR visualization
 * page from the brand_docs.okr_2026_2027 markdown.
 *
 * Parser is intentionally lenient: it ignores annual Objectives (§3-§4),
 * critical paths (§6), risks (§8) — they live in markdown for reading via
 * the BrandDoc editor. Page only renders quarterly OKRs (§5).
 */

export type KrStatus = 'on_track' | 'at_risk' | 'off_track' | 'done' | 'unknown'

export interface ParsedKR {
  id: string         // stable: "Q2-2026-O1-KR1" (composite path)
  text: string       // first column of KR table
  metric: string     // second column
  targetMin: string  // third column as-is ("100% к 20.06" / "5 / 4")
}

export interface ParsedObjective {
  id: string         // "Q2-2026-O1"
  title: string      // "Финализировать R&D детского набора (A1)"
  krs: ParsedKR[]
}

export interface ParsedQuarter {
  id: string                // "Q2-2026"
  label: string             // "Q2 2026 (апрель-июнь)"
  focus: string             // blockquote after header
  objectives: ParsedObjective[]
  antiGoals: string[]
}

export interface ParsedOkr {
  quarters: ParsedQuarter[]
  currentQuarterId: string | null  // by today's date; null if no match
}

/**
 * Given today's date (or `now`), returns the quarter id in "QN-YYYY" form.
 */
export function currentQuarterId(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1  // 1-12
  const q = Math.ceil(month / 3)
  return `Q${q}-${year}`
}

/**
 * Parse the full OKR markdown. Throws if structure is critically broken
 * (no `## 5. Квартальные OKR` section).
 */
export function parseOkr(markdown: string): ParsedOkr {
  const quarterly = extractSection(markdown, '## 5. Квартальные OKR')
  if (!quarterly) {
    return { quarters: [], currentQuarterId: null }
  }

  const quarters: ParsedQuarter[] = []
  // Split by ### Qn YYYY headers
  const quarterBlocks = splitByHeader(quarterly, /^### (Q[1-4]) (\d{4})/m)
  for (const block of quarterBlocks) {
    const headerMatch = block.body.match(/^### (Q[1-4]) (\d{4})\s*(.*)$/m)
    if (!headerMatch) continue
    const [, q, year, suffix] = headerMatch
    const id = `${q}-${year}`
    const label = `${q} ${year}${suffix ? ' ' + suffix.trim() : ''}`.trim()

    quarters.push({
      id,
      label,
      focus: extractFocus(block.body),
      objectives: extractObjectives(block.body, id),
      antiGoals: extractAntiGoals(block.body),
    })
  }

  const todayQid = currentQuarterId()
  const currentQuarterIdResolved =
    quarters.find((q) => q.id === todayQid)?.id ??
    quarters[0]?.id ?? null

  return { quarters, currentQuarterId: currentQuarterIdResolved }
}

// ---- helpers ----

function extractSection(md: string, header: string): string | null {
  const startIdx = md.indexOf(header)
  if (startIdx < 0) return null
  // Find next h2 (## ...) or end of doc
  const restAfterHeader = md.slice(startIdx + header.length)
  const nextH2Match = restAfterHeader.match(/^## (?!#)/m)
  const sectionEnd = nextH2Match
    ? startIdx + header.length + nextH2Match.index!
    : md.length
  return md.slice(startIdx, sectionEnd)
}

interface HeaderBlock { header: string; body: string }

function splitByHeader(md: string, headerRegex: RegExp): HeaderBlock[] {
  const lines = md.split('\n')
  const blocks: HeaderBlock[] = []
  let currentHeader: string | null = null
  let currentLines: string[] = []
  for (const line of lines) {
    if (headerRegex.test(line)) {
      if (currentHeader !== null) {
        blocks.push({ header: currentHeader, body: [currentHeader, ...currentLines].join('\n') })
      }
      currentHeader = line
      currentLines = []
    } else if (currentHeader !== null) {
      currentLines.push(line)
    }
  }
  if (currentHeader !== null) {
    blocks.push({ header: currentHeader, body: [currentHeader, ...currentLines].join('\n') })
  }
  return blocks
}

function extractFocus(quarterBody: string): string {
  const lines = quarterBody.split('\n')
  for (const line of lines) {
    if (line.startsWith('> ')) {
      return line.slice(2).replace(/^Фокус:\s*/, '').trim()
    }
  }
  return ''
}

function extractObjectives(quarterBody: string, quarterId: string): ParsedObjective[] {
  const objectives: ParsedObjective[] = []
  // Match #### Q2-O1. Title
  const objBlocks = splitByHeader(quarterBody, /^#### (Q\d-O\d+)\./)
  for (const block of objBlocks) {
    const headerMatch = block.header.match(/^#### (Q\d-O\d+)\.\s*(.+)$/)
    if (!headerMatch) continue
    const [, shortId, title] = headerMatch
    const id = `${quarterId}-${shortId.split('-')[1]}`  // "Q2-2026-O1"
    const krs = extractKrs(block.body, id)
    objectives.push({ id, title: title.trim(), krs })
  }
  return objectives
}

function extractKrs(objectiveBody: string, objectiveId: string): ParsedKR[] {
  const lines = objectiveBody.split('\n')
  const krs: ParsedKR[] = []
  let inTable = false
  let skipSeparator = false
  let krIndex = 0

  for (const line of lines) {
    if (line.startsWith('| Key Result')) {
      inTable = true
      skipSeparator = true
      continue
    }
    if (inTable && skipSeparator && /^\|\s*-/.test(line)) {
      skipSeparator = false
      continue
    }
    if (inTable && line.startsWith('|') && !skipSeparator) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      if (cells.length >= 3) {
        krIndex++
        krs.push({
          id: `${objectiveId}-KR${krIndex}`,
          text: cells[0],
          metric: cells[1],
          targetMin: cells[2],
        })
      }
    } else if (inTable && !line.startsWith('|')) {
      inTable = false
    }
  }
  return krs
}

function extractAntiGoals(quarterBody: string): string[] {
  // Find subsection "#### Q? — Anti-goals"
  const antiBlock = quarterBody.match(/####\s*Q\d\s*—\s*Anti-goals[\s\S]*?(?=^####|^###|$)/m)
  if (!antiBlock) return []
  const lines = antiBlock[0].split('\n')
  const items: string[] = []
  for (const line of lines) {
    const m = line.match(/^- (?:\*\*НЕ\*\*|НЕ)\s*(.+)$/)
    if (m) items.push(`НЕ ${m[1].trim()}`)
  }
  return items
}
```

**Step 2: Sanity-check via inline test**

Создай временный файл `/tmp/test-okr-parser.ts`:

```typescript
import { parseOkr, currentQuarterId } from '../frontend/src/lib/okr-parser'
import fs from 'fs'

const md = fs.readFileSync('/Users/vasilijaistov/Desktop/Химичка_OKR_2026-2027.md', 'utf-8')
const result = parseOkr(md)

console.log('Quarters parsed:', result.quarters.length)
console.log('Current quarter ID:', result.currentQuarterId)
console.log('Today calc:', currentQuarterId())
for (const q of result.quarters) {
  console.log(`\n${q.id}: ${q.label}`)
  console.log(`  focus: ${q.focus.slice(0, 60)}...`)
  console.log(`  objectives: ${q.objectives.length}`)
  for (const o of q.objectives) {
    console.log(`    ${o.id}: ${o.title} (${o.krs.length} KRs)`)
  }
  console.log(`  anti-goals: ${q.antiGoals.length}`)
}
```

Run: `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka && npx tsx /tmp/test-okr-parser.ts`

Expected:
- `Quarters parsed: 7` (Q2 2026 — Q4 2027)
- `Current quarter ID: Q2-2026`
- Q2-2026 имеет 3 objectives, каждый с 3 KR'ами
- Q2-2026 anti-goals: 3 шт

Если что-то не сходится — починить парсер до прохождения этого мини-теста. Удалить /tmp файл после.

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep okr-parser
```
Expected: пусто.

**Step 4: Commit**

```bash
git add frontend/src/lib/okr-parser.ts
git commit -m "feat(okr): markdown parser for OKR visualization page"
```

---

## Task 2: OKR API helpers (статусы)

**Files:**
- Create: `frontend/src/api/okrStatus.ts`

**Step 1: Implement**

`frontend/src/api/okrStatus.ts`:

```typescript
import { brandDocsApi } from './brandDocs'
import type { KrStatus } from '../lib/okr-parser'

const SLUG = 'okr_status'
const TITLE = 'OKR — статусы KR'

export interface KrStatusEntry {
  status: KrStatus
  comment?: string
  updated_at: string  // ISO
}

export interface OkrStatusDoc {
  version: number
  updated_at: string
  statuses: Record<string, KrStatusEntry>  // keyed by KR id ("Q2-2026-O1-KR1")
}

const EMPTY_DOC: OkrStatusDoc = {
  version: 1,
  updated_at: new Date(0).toISOString(),
  statuses: {},
}

export const okrStatusApi = {
  async load(): Promise<OkrStatusDoc> {
    const doc = await brandDocsApi.get(SLUG)
    if (!doc || !doc.content) return EMPTY_DOC
    try {
      const parsed = JSON.parse(doc.content) as OkrStatusDoc
      if (!parsed.statuses) return EMPTY_DOC
      return parsed
    } catch {
      return EMPTY_DOC
    }
  },

  /**
   * Upsert a single KR's status. Read-modify-write semantics; if two clients
   * race, last-writer-wins (acceptable for single-operator workflow).
   */
  async setKrStatus(krId: string, status: KrStatus, comment?: string): Promise<OkrStatusDoc> {
    const current = await this.load()
    const next: OkrStatusDoc = {
      version: 1,
      updated_at: new Date().toISOString(),
      statuses: {
        ...current.statuses,
        [krId]: {
          status,
          ...(comment !== undefined ? { comment } : {}),
          updated_at: new Date().toISOString(),
        },
      },
    }
    await brandDocsApi.upsert(SLUG, { title: TITLE, content: JSON.stringify(next, null, 2) })
    return next
  },

  /** Remove a KR's status (sets to unknown). */
  async clearKrStatus(krId: string): Promise<OkrStatusDoc> {
    const current = await this.load()
    const { [krId]: _, ...remaining } = current.statuses
    const next: OkrStatusDoc = {
      version: 1,
      updated_at: new Date().toISOString(),
      statuses: remaining,
    }
    await brandDocsApi.upsert(SLUG, { title: TITLE, content: JSON.stringify(next, null, 2) })
    return next
  },
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep okrStatus
```
Expected: пусто.

**Step 3: Commit**

```bash
git add frontend/src/api/okrStatus.ts
git commit -m "feat(okr): okrStatusApi — read/write KR statuses via brand_docs slug"
```

---

## Task 3: KrRow component

**Files:**
- Create: `frontend/src/components/okr/KrRow.tsx`

**Step 1: Implement**

`frontend/src/components/okr/KrRow.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ParsedKR, KrStatus } from '../../lib/okr-parser'

interface Props {
  kr: ParsedKR
  status: KrStatus
  comment?: string
  onChange: (krId: string, status: KrStatus, comment?: string) => void | Promise<void>
  busy?: boolean
}

const STATUS_OPTIONS: Array<{ value: KrStatus; label: string; emoji: string; color: string }> = [
  { value: 'on_track',  label: 'On track',  emoji: '🟢', color: 'bg-green-500' },
  { value: 'at_risk',   label: 'At risk',   emoji: '🟡', color: 'bg-amber-500' },
  { value: 'off_track', label: 'Off track', emoji: '🔴', color: 'bg-red-500' },
  { value: 'done',      label: 'Done',      emoji: '✅', color: 'bg-blue-500' },
  { value: 'unknown',   label: 'Не оценено', emoji: '⚪', color: 'bg-gray-300' },
]

function statusColor(status: KrStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.color ?? 'bg-gray-300'
}

export function KrRow({ kr, status, comment, onChange, busy = false }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState(comment ?? '')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCommentDraft(comment ?? '')
  }, [comment])

  useEffect(() => {
    if (!popoverOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [popoverOpen])

  const handleSelect = async (next: KrStatus) => {
    setPopoverOpen(false)
    await onChange(kr.id, next, commentDraft.trim() || undefined)
  }

  const handleSaveComment = async () => {
    await onChange(kr.id, status, commentDraft.trim() || undefined)
  }

  return (
    <div ref={containerRef} className="relative flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        disabled={busy}
        className={`w-4 h-4 rounded-full shrink-0 mt-1 transition-transform hover:scale-110 disabled:opacity-50 ${statusColor(status)}`}
        title="Изменить статус"
        aria-label={`Статус KR: ${status}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-brand-text">{kr.text}</div>
        <div className="text-xs text-brand-text-secondary mt-0.5">
          {kr.metric ? `${kr.metric} · ` : ''}
          {kr.targetMin}
          {comment && <span className="ml-2 italic">«{comment}»</span>}
        </div>
      </div>

      {popoverOpen && (
        <div className="absolute left-0 top-7 w-72 bg-card border border-brand-border rounded-xl shadow-lg z-20 p-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void handleSelect(opt.value)}
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-subtle text-sm ${
                opt.value === status ? 'bg-subtle font-medium' : ''
              }`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
              {opt.value === status && <Check size={14} className="ml-auto text-primary-600" />}
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-brand-border">
            <input
              type="text"
              placeholder="Комментарий (опционально)"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveComment().then(() => setPopoverOpen(false))
              }}
              className="input text-xs py-1"
            />
            <div className="flex justify-between mt-2">
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="text-xs text-brand-text-secondary hover:text-brand-text"
              >
                Закрыть
              </button>
              {comment && (
                <button
                  type="button"
                  onClick={() => {
                    setCommentDraft('')
                    void onChange(kr.id, status, undefined)
                    setPopoverOpen(false)
                  }}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={12} /> убрать комментарий
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep KrRow
```
Expected: пусто.

**Step 3: Commit**

```bash
git add frontend/src/components/okr/KrRow.tsx
git commit -m "feat(okr): KrRow component with clickable status circle + comment popover"
```

---

## Task 4: AntiGoalsBar + QuarterSelector components

**Files:**
- Create: `frontend/src/components/okr/AntiGoalsBar.tsx`
- Create: `frontend/src/components/okr/QuarterSelector.tsx`

**Step 1: AntiGoalsBar**

```tsx
interface Props {
  antiGoals: string[]
}

export function AntiGoalsBar({ antiGoals }: Props) {
  if (antiGoals.length === 0) {
    return (
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-card/80 backdrop-blur border-b border-brand-border text-xs text-brand-text-secondary">
        Anti-goals для квартала не заданы
      </div>
    )
  }
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-amber-50/95 backdrop-blur border-b border-amber-200 dark:bg-amber-950/60 dark:border-amber-900">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
        Anti-goals
      </div>
      <ul className="space-y-0.5">
        {antiGoals.map((g, i) => (
          <li key={i} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <span aria-hidden>🚫</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Step 2: QuarterSelector**

```tsx
import type { ParsedQuarter } from '../../lib/okr-parser'

interface Props {
  quarters: ParsedQuarter[]
  value: string
  onChange: (id: string) => void
}

export function QuarterSelector({ quarters, value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input text-sm py-1.5 shrink-0"
      title="Выбрать квартал"
    >
      {quarters.map((q) => (
        <option key={q.id} value={q.id}>
          {q.label}
        </option>
      ))}
    </select>
  )
}
```

**Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "AntiGoalsBar|QuarterSelector"
```
Expected: пусто.

**Step 4: Commit**

```bash
git add frontend/src/components/okr/AntiGoalsBar.tsx frontend/src/components/okr/QuarterSelector.tsx
git commit -m "feat(okr): AntiGoalsBar (sticky) + QuarterSelector"
```

---

## Task 5: OkrPage — собрать всё вместе

**Files:**
- Create: `frontend/src/pages/OkrPage.tsx`

**Step 1: Implement**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Target, RefreshCw, FileText } from 'lucide-react'
import { brandDocsApi } from '../api/brandDocs'
import { okrStatusApi, OkrStatusDoc } from '../api/okrStatus'
import { parseOkr, ParsedOkr, KrStatus } from '../lib/okr-parser'
import { useToast } from '../contexts/ToastContext'
import { AntiGoalsBar } from '../components/okr/AntiGoalsBar'
import { QuarterSelector } from '../components/okr/QuarterSelector'
import { KrRow } from '../components/okr/KrRow'

const OKR_SLUG = 'okr_2026_2027'

function summary(quarters: ParsedOkr['quarters'], qid: string, statuses: OkrStatusDoc['statuses']) {
  const q = quarters.find((x) => x.id === qid)
  if (!q) return { on_track: 0, at_risk: 0, off_track: 0, done: 0, unknown: 0, total: 0 }
  const all = q.objectives.flatMap((o) => o.krs)
  const counts = { on_track: 0, at_risk: 0, off_track: 0, done: 0, unknown: 0 }
  for (const kr of all) {
    const s = statuses[kr.id]?.status ?? 'unknown'
    counts[s] = (counts[s] ?? 0) + 1
  }
  return { ...counts, total: all.length }
}

export default function OkrPage() {
  const toast = useToast()
  const [okr, setOkr] = useState<ParsedOkr | null>(null)
  const [statusDoc, setStatusDoc] = useState<OkrStatusDoc | null>(null)
  const [selectedQid, setSelectedQid] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busyKrId, setBusyKrId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [doc, statusD] = await Promise.all([
        brandDocsApi.get(OKR_SLUG),
        okrStatusApi.load(),
      ])
      if (!doc || !doc.content) {
        setError(`Документ ${OKR_SLUG} не найден в brand_docs.`)
        return
      }
      const parsed = parseOkr(doc.content)
      if (parsed.quarters.length === 0) {
        setError('Не удалось распарсить OKR. Проверь структуру § 5 «Квартальные OKR».')
        return
      }
      setOkr(parsed)
      setStatusDoc(statusD)
      setSelectedQid(parsed.currentQuarterId ?? parsed.quarters[0].id)
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const currentQuarter = useMemo(
    () => okr?.quarters.find((q) => q.id === selectedQid) ?? null,
    [okr, selectedQid],
  )

  const counts = useMemo(
    () => (okr && statusDoc) ? summary(okr.quarters, selectedQid, statusDoc.statuses) : null,
    [okr, statusDoc, selectedQid],
  )

  const handleKrChange = async (krId: string, status: KrStatus, comment?: string) => {
    if (!statusDoc) return
    setBusyKrId(krId)
    const previous = statusDoc
    try {
      // Optimistic update
      const optimisticStatuses = { ...previous.statuses }
      if (status === 'unknown') {
        delete optimisticStatuses[krId]
      } else {
        optimisticStatuses[krId] = {
          status,
          ...(comment !== undefined ? { comment } : {}),
          updated_at: new Date().toISOString(),
        }
      }
      setStatusDoc({ ...previous, statuses: optimisticStatuses })

      // Persist
      const next = status === 'unknown'
        ? await okrStatusApi.clearKrStatus(krId)
        : await okrStatusApi.setKrStatus(krId, status, comment)
      setStatusDoc(next)
      toast.success('Сохранено')
    } catch {
      setStatusDoc(previous)
      toast.error('Не удалось сохранить статус')
    } finally {
      setBusyKrId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-16 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-brand-text mb-2 flex items-center gap-2">
          <Target className="h-6 w-6 text-primary-600" /> OKR
        </h1>
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      </div>
    )
  }

  if (!okr || !currentQuarter) return null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <header className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-text flex items-center gap-2">
            <Target className="h-6 w-6 text-primary-600" /> OKR Химички
          </h1>
          {currentQuarter.focus && (
            <p className="text-sm text-brand-text-secondary mt-1">
              <span className="font-medium">Фокус:</span> {currentQuarter.focus}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QuarterSelector
            quarters={okr.quarters}
            value={selectedQid}
            onChange={setSelectedQid}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-lg border border-brand-border hover:bg-subtle"
            title="Обновить"
          >
            <RefreshCw size={16} />
          </button>
          <a
            href="/marketing/strategy"
            className="p-2 rounded-lg border border-brand-border hover:bg-subtle flex items-center gap-1 text-xs"
            title="Открыть OKR-документ в маркетинг-стратегии"
          >
            <FileText size={14} /> MD
          </a>
        </div>
      </header>

      <AntiGoalsBar antiGoals={currentQuarter.antiGoals} />

      <div className="mt-4 space-y-4">
        {currentQuarter.objectives.map((obj) => (
          <section key={obj.id} className="rounded-2xl border border-brand-border bg-card p-4">
            <h2 className="text-base font-semibold text-brand-text mb-2">
              {obj.id.split('-').slice(-1)[0]}. {obj.title}
            </h2>
            <div className="divide-y divide-brand-border">
              {obj.krs.map((kr) => (
                <KrRow
                  key={kr.id}
                  kr={kr}
                  status={statusDoc?.statuses[kr.id]?.status ?? 'unknown'}
                  comment={statusDoc?.statuses[kr.id]?.comment}
                  onChange={handleKrChange}
                  busy={busyKrId === kr.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {counts && (
        <div className="mt-6 rounded-2xl border border-brand-border bg-card p-3 flex items-center justify-around text-sm">
          <span>🟢 {counts.on_track}</span>
          <span>🟡 {counts.at_risk}</span>
          <span>🔴 {counts.off_track}</span>
          <span>✅ {counts.done}</span>
          <span>⚪ {counts.unknown}</span>
          <span className="text-brand-text-secondary ml-2">из {counts.total}</span>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep OkrPage
```
Expected: пусто.

**Step 3: Commit**

```bash
git add frontend/src/pages/OkrPage.tsx
git commit -m "feat(okr): OkrPage — current-quarter view with KR statuses + summary"
```

---

## Task 6: Route + sidebar nav

**Files:**
- Modify: `frontend/src/App.tsx` (add lazy import + Route)
- Modify: `frontend/src/components/Layout.tsx:339` (add nav item)

**Step 1: App.tsx — lazy import**

Найди существующий `const MarketingStrategy = lazy(() => import('./pages/MarketingStrategy'))` (около строки 43) и добавь сразу после него:

```tsx
const OkrPage = lazy(() => import('./pages/OkrPage'))
```

**Step 2: App.tsx — Route**

Найди `<Route path="/marketing/strategy" element={<MarketingStrategy />} />` (около строки 139) и добавь после неё:

```tsx
<Route path="/marketing/okr" element={<OkrPage />} />
```

**Step 3: Layout.tsx — sidebar item**

В `frontend/src/components/Layout.tsx`, найди группу `marketing` (строки 335-344) и добавь пункт OKR сразу после Стратегии:

```tsx
  {
    id: 'marketing',
    label: 'Маркетинг',
    items: [
      { type: 'link', name: 'Стратегия', href: '/marketing/strategy', icon: IconMarketing },
      { type: 'link', name: 'OKR', href: '/marketing/okr', icon: IconMarketing },  // <-- добавить
      { type: 'link', name: 'Контент-банк', href: '/content-bank', icon: IconContent },
      ...
```

(Используем тот же `IconMarketing` что и у Стратегии — целевая иконка `Target` уже использована на странице самой, а в сайдбаре нужен консистентный визуальный паттерн.)

**Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "App|Layout"
```
Expected: пусто.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(okr): mount /marketing/okr route + sidebar nav item"
```

---

## Task 7: Финальный smoke + push

**Step 1: Прогнать smoke checklist локально**

Pre-flight: `cd backend && npm run dev` + `cd frontend && npm run dev`. Залогинься.

1. Открой http://localhost:5173/marketing/okr — страница открывается, видишь Q2 2026 по умолчанию.
2. Под header — sticky-bar Anti-goals из 3 пунктов («НЕ запускаем PPC-трафик», «НЕ начинаем переговоры с крупным B2B», «НЕ финализируем EdTech-платформу»).
3. Три карточки Objective: Q2-O1, Q2-O2, Q2-O3, у каждого по 3 KR с серыми кружками.
4. Клик на серый кружок → popover «🟢 On track / 🟡 At risk / 🔴 Off track / ✅ Done / ⚪ Не оценено» + поле для коммента.
5. Выбираешь «🟢 On track» → popover закрывается, кружок зеленеет, тост «Сохранено».
6. Refresh страницы → статус сохранился (зелёный кружок остаётся).
7. Снизу сводка показывает «🟢 1 🟡 0 🔴 0 ✅ 0 ⚪ 8 из 9».
8. Меняешь квартал в dropdown на Q3 2026 → видишь Q3 anti-goals (нет в нашем доке — должно показать «Anti-goals для квартала не заданы», т.к. в Q3 их в md нет) и 3 Objectives Q3.
9. Sidebar: «🎯 OKR» под «Стратегией» в группе Маркетинг (хотя без эмодзи — текст «OKR» + иконка IconMarketing).
10. Кнопка `[MD]` ведёт на `/marketing/strategy`.

Если что-то падает — пиши, фиксим.

**Step 2: Push**

```bash
git push origin main
git push vercel-deploy main
```

**Step 3: Прод-smoke**

После Vercel-деплоя (~2 мин) — те же пункты на `https://erp.ximi4ka.ru/marketing/okr`. Особое внимание: проставленный локально статус не дойдёт до прода — там пустой `okr_status`. Поставь 1-2 для проверки persistance.

---

## Reference: skill bridges

- @superpowers:executing-plans — execute этот план task-by-task (subagent-driven из текущей сессии)
- @superpowers:systematic-debugging — если парсер не матчит структуру
- @superpowers:verification-before-completion — проверить smoke до push'а

## Principles baked in

- **DRY** — переиспользуем существующий `brandDocsApi` для статусов, никаких новых эндпоинтов
- **YAGNI** — только текущий квартал, manual статусы, никаких roadmap/heatmap/auto-расчётов; всё это — в Open Questions для v2+
- **TDD-адаптированный** — каждая задача завершается typecheck + smoke. Парсер дополнительно проходит inline-тест на реальном OKR-документе
- **Frequent commits** — 7 атомарных коммитов, каждый ревьюется/откатывается независимо
