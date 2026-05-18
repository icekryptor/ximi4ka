# OGE Task Bank Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development.

**Goal:** Add task bank (practice + 30/50-question test) to OGE module with import + AI-gen + chemist review workflow.

**Architecture:** New tables `oge_topics`, `oge_tasks` (with status), `oge_task_attempts`, `oge_test_runs`. Content gated by chemist approval. Practice and test modes share question rendering. XP feeds into existing `task_attempts` so ranks/discounts update automatically.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind, Anthropic SDK (for AI generation), lucide-react.

**Reference design doc:** `docs/plans/2026-05-18-oge-task-bank-design.md`

**Working directory:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka/learn`

**Verification command:** `npm run build` must succeed with zero ESLint errors.

---

## Batch A — Foundation (DB + lib helpers)

### Task 1: Migration 011_oge_task_bank.sql

Use the EXACT SQL from design doc "Database schema" section. Includes 4 tables + RLS + seed of 11 topics.

Apply via Supabase MCP `apply_migration` (project_id `ovbqcfhecftjfejtxsas`, name `011_oge_task_bank`), then save file at `learn/supabase/migrations/011_oge_task_bank.sql`.

Verify with: `SELECT name, slug FROM oge_topics ORDER BY order_index;` → 11 rows.

Commit: `feat(db): oge_topics/tasks/attempts/test_runs + 11 topic seed`

### Task 2: Library `learn/src/lib/oge-tasks.ts`

Pure functions and types:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuestionType = "single" | "multi" | "matching";
export type TaskStatus = "pending_review" | "approved" | "rejected" | "archived";
export type TaskSource = "imported" | "ai_generated" | "manual";

export interface OgeTask {
  id: string;
  topic_id: string;
  type: QuestionType;
  difficulty: number;
  question: string;
  options: unknown;
  correct: unknown;
  explanation: string | null;
  status: TaskStatus;
  source: TaskSource;
}

export interface OgeTopic {
  id: string;
  slug: string;
  name: string;
  exam_tasks: string | null;
  order_index: number;
}

// Validate a task payload before inserting (used by import + AI gen)
export function validateTaskPayload(t: unknown): string | null {
  if (typeof t !== "object" || t === null) return "Not an object";
  const o = t as Record<string, unknown>;
  if (typeof o.topic !== "string") return "topic missing";
  if (!["single", "multi", "matching"].includes(o.type as string)) return "type invalid";
  if (typeof o.question !== "string" || !o.question.trim()) return "question missing";
  if (!Array.isArray(o.options) && (o.type !== "matching" || typeof o.options !== "object")) return "options missing";
  if (o.correct === undefined) return "correct missing";
  return null;
}

// Score one student answer against the task's correct value
export function isAnswerCorrect(task: { type: QuestionType; correct: unknown }, answer: unknown): boolean {
  if (task.type === "single") {
    return Number(answer) === Number(task.correct);
  }
  if (task.type === "multi") {
    const c = Array.isArray(task.correct) ? task.correct.map(Number).sort((a,b)=>a-b) : [];
    const a = Array.isArray(answer) ? answer.map(Number).sort((a,b)=>a-b) : [];
    return c.length === a.length && c.every((v, i) => v === a[i]);
  }
  if (task.type === "matching") {
    const c = Array.isArray(task.correct) ? task.correct as number[][] : [];
    const a = Array.isArray(answer) ? answer as number[][] : [];
    if (c.length !== a.length) return false;
    return c.every((pair, i) => pair[0] === a[i]?.[0] && pair[1] === a[i]?.[1]);
  }
  return false;
}

// Pick next unattempted approved task for a user in a topic
export async function pickNextPracticeTask(supabase: SupabaseClient, userId: string, topicId: string): Promise<OgeTask | null> {
  // Get all approved task ids for this topic
  const { data: approved } = await supabase
    .from("oge_tasks")
    .select("id")
    .eq("topic_id", topicId)
    .eq("status", "approved");
  if (!approved || approved.length === 0) return null;
  const approvedIds = approved.map(t => t.id);

  // Get user's already-correct attempt task ids
  const { data: solved } = await supabase
    .from("oge_task_attempts")
    .select("task_id")
    .eq("user_id", userId)
    .eq("mode", "practice")
    .eq("is_correct", true)
    .in("task_id", approvedIds);
  const solvedIds = new Set((solved ?? []).map(s => s.task_id));

  // Prefer unsolved
  const remaining = approvedIds.filter(id => !solvedIds.has(id));
  const pool = remaining.length > 0 ? remaining : approvedIds;
  const pickId = pool[Math.floor(Math.random() * pool.length)];

  const { data: task } = await supabase.from("oge_tasks").select("*").eq("id", pickId).single();
  return task as OgeTask | null;
}
```

Commit: `feat(oge): library — types, validator, answer scorer, next-task picker`

### Task 3: CLI import `learn/scripts/import-oge-bank.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { validateTaskPayload } from "../src/lib/oge-tasks";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  argv.slice(2).forEach(a => {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input) { console.error("Usage: --input=tasks.json [--source=имя]"); process.exit(1); }
  const sourceName = args.source ?? "manual_import";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("missing env"); process.exit(1); }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const raw = JSON.parse(readFileSync(args.input, "utf-8"));
  if (!Array.isArray(raw)) { console.error("Input must be a JSON array"); process.exit(1); }

  // Load topics for slug→id resolution
  const { data: topics } = await admin.from("oge_topics").select("id, slug");
  const slugMap = new Map((topics ?? []).map(t => [t.slug, t.id]));

  const batchId = crypto.randomUUID();
  let inserted = 0, skipped = 0;
  const errors: string[] = [];

  for (const [i, t] of raw.entries()) {
    const err = validateTaskPayload(t);
    if (err) { errors.push(`row ${i}: ${err}`); skipped++; continue; }
    const topicId = slugMap.get(t.topic);
    if (!topicId) { errors.push(`row ${i}: unknown topic '${t.topic}'`); skipped++; continue; }
    const { error: insErr } = await admin.from("oge_tasks").insert({
      topic_id: topicId,
      type: t.type,
      difficulty: t.difficulty ?? 2,
      question: t.question,
      options: t.options,
      correct: t.correct,
      explanation: t.explanation ?? null,
      status: "pending_review",
      source: "imported",
      source_meta: { batch_id: batchId, source_name: sourceName, row_index: i },
    });
    if (insErr) { errors.push(`row ${i}: ${insErr.message}`); skipped++; continue; }
    inserted++;
  }

  console.log(`Inserted: ${inserted}, skipped: ${skipped}`);
  if (errors.length) console.log("Errors:\n" + errors.join("\n"));
}
main().catch(e => { console.error(e); process.exit(1); });
```

Add npm script: `"oge:import": "tsx --env-file=.env.local scripts/import-oge-bank.ts"`

Test with a tiny sample JSON `/tmp/sample.json`:
```json
[
  { "topic": "atomistics", "type": "single", "difficulty": 1,
    "question": "Сколько электронов в атоме углерода?",
    "options": ["4", "6", "8", "12"], "correct": 1,
    "explanation": "Углерод имеет порядковый номер 6, значит 6 электронов." }
]
```

Run: `npm run oge:import -- --input=/tmp/sample.json --source=test`
Verify in DB: `SELECT count(*) FROM oge_tasks WHERE source='imported';` → 1
Then DELETE the test row.

Commit: `feat(oge): CLI import-oge-bank for bulk seeding from JSON`

---

## Batch B — Student practice mode

### Task 4: `/learn/oge/bank/page.tsx` (topic lobby)

Server component. Fetch 11 topics. For each, get count of approved tasks + count of user's solved tasks. Render 11 cards in grid.

Dark theme (under `(learn)/layout.tsx`). Use existing Card + StatusPill or simple custom rows.

Each card:
- Topic name (h3 font-display)
- "ОГЭ задания: 1, 2" (gray small)
- "12 из 24 решено" with mini progress bar
- "Перейти →" link to `/learn/oge/bank/[slug]`

Empty case: "Скоро здесь будут задания" if 0 approved for topic.

### Task 5: `/learn/oge/bank/[topic]/page.tsx` (solving)

Server component. Resolve topic by slug. Fetch user. Call `pickNextPracticeTask`. If null → "Все задания этой темы пройдены, поздравляем!" with link back.

Render `<QuestionCard task={task} mode="practice" />` (client component, see Task 6).

### Task 6: `learn/src/components/oge/QuestionCard.tsx`

Client component. Props: `task`, `mode: "practice" | "test"`, `onSubmit?: (answer) => Promise<{correct, explanation}>`.

Renders:
- `<single>`: radio group
- `<multi>`: checkbox group
- `<matching>`: two columns, each right side has dropdown to pick left index

"Проверить" button → calls onSubmit (practice) or stores in parent state (test).

After submit in practice mode: show feedback (green/red border, highlight correct, explanation expanded). "Следующее задание →" navigates to same /bank/[topic] page (next task auto-selected by Task 5).

### Task 7: `/api/oge-tasks/attempt` (POST)

Body: `{ task_id, answer, mode, time_spent_ms, test_run_id? }`.

Server: fetch task, scoreAnswer, insert into `oge_task_attempts`. If mode=practice and is_correct, also insert into `task_attempts` with `points_earned=10, source='oge_practice', tool_meta={task_id, topic_slug}` (use service role client to bypass RLS write).

Response: `{ is_correct, correct: <correct value>, explanation }`.

Commits one per task. After Batch B push.

---

## Batch C — Student test mode

### Task 8: `/api/oge-tasks/test/start` (POST)

Body: `{ topic_id? (null = all), questions_n: 30|50 }`.

Server:
- Validate questions_n in [30, 50]
- Pick N random approved tasks (filtered by topic if provided)
- If fewer than N available → return error "Недостаточно одобренных заданий для теста (есть K, нужно N)"
- Create `oge_test_runs` row: `user_id, topic_id, questions_n, correct_n=0, started_at=now()`
- Return: `{ run_id, task_ids: [...] }`

### Task 9: `/learn/oge/test/page.tsx` (lobby + history)

Server component. Form for topic + questions_n. List past `oge_test_runs` with score + topic + date + link to `[runId]/result`.

### Task 10: `/learn/oge/test/[id]/page.tsx` (test runner)

Server fetches: test_run, list of tasks via stored task_ids. Renders client component `<TestRunner>` that:
- Shows one question at a time with progress "7 из 30"
- "Следующий" button submits to `/api/oge-tasks/attempt` with mode=test, test_run_id
- After last question → POST `/api/oge-tasks/test/finish`, then router.push to `[id]/result`
- No back button

### Task 11: `/api/oge-tasks/test/finish` (POST)

Body: `{ test_run_id }`.

Server:
- Aggregate attempts for run_id: count correct
- Update `oge_test_runs`: finished_at, correct_n, score_pct
- Award XP: insert into `task_attempts` with `points_earned = 5*correct_n + 50, source='oge_test', tool_meta={test_run_id, score_pct}`
- Idempotent: if already finished_at IS NOT NULL, return existing data without re-awarding XP

Response: `{ score_pct, correct_n, questions_n }`.

### Task 12: `/learn/oge/test/[id]/result/page.tsx`

Server fetches run + attempts joined with tasks. Shows big score, breakdown (by topic if multi-topic, by difficulty otherwise), toggle "Разобрать ошибки" → list of incorrect questions with correct answer + explanation.

CTA: "Запустить ещё раз" with same params (creates new run).

---

## Batch D — Admin review + AI generation

### Task 13: `/admin/oge-tasks/page.tsx`

Server component. Table-style list:
- Filters: status (default pending_review), topic, type, source
- Columns: question preview (first 80 chars), type, difficulty, topic, source pill, age
- Row actions: ✓ Approve, ✏️ Edit, ✗ Reject

Approve/Reject use small client form per row. Edit goes to `[id]/page.tsx` (Task 14).

Top bar: "✨ Сгенерить задания" button → opens dialog (client) with topic/type/difficulty/count fields → POSTs to generate endpoint (Task 15).

Stats card showing counts: pending / approved / rejected per topic (small grid).

### Task 14: `/admin/oge-tasks/[id]/page.tsx`

Edit form (client component). All task fields editable + reviewer_notes. "Сохранить и одобрить" / "Сохранить как черновик" buttons.

### Task 15: `/api/admin/oge-tasks/generate` (POST)

Body: `{ topic_slug, type, difficulty, count }`.

Auth: admin only.

If `ANTHROPIC_API_KEY` missing → 503 with message "Не настроен AI ключ — добавьте в Vercel env".

Calls Anthropic SDK with strict prompt:
```
Ты эксперт по химии и составитель заданий для ОГЭ-2026.
Сгенерируй ${count} заданий по теме "${topicName}".
Тип: ${type}.
Сложность: ${difficulty} (1=лёгкое, 2=среднее, 3=сложное).

Каждое задание в JSON формате:
{
  "type": "${type}",
  "question": "формулировка задания (markdown)",
  "options": [...],   // для single/multi массив строк, для matching {left, right}
  "correct": ...,     // для single число (индекс), для multi массив индексов, для matching массив пар
  "explanation": "разбор решения с указанием правильного ответа"
}

Используй HTML-теги <sub>...</sub> и <sup>...</sup> для индексов и степеней в формулах.

Верни ответ как JSON-массив (без markdown wrapper).
```

Use Claude Sonnet 4. Validate each item with `validateTaskPayload`. Insert valid ones with `source='ai_generated'`, `source_meta={model, prompt_v: 1, generated_at}`.

Returns `{ inserted: N, errors: [...] }`.

### Task 16: Wire admin nav

Modify `(admin)/layout.tsx` adminNav array to add:
```ts
{ href: "/admin/oge-tasks", label: "Задания ОГЭ" },
```
Place between "Модули" and "Промокоды".

### Task 17: `/learn/oge` — add Учёба section

Modify `learn/src/app/(learn)/learn/[slug]/page.tsx`. In OGE branch, add new section header "Учёба" below the existing "Инструменты" section, with 2 cards:
- 📚 Банк заданий → /learn/oge/bank (lucide BookOpenCheck icon)
- 📝 Контрольный тест → /learn/oge/test (lucide ClipboardCheck icon)

Match styling of existing tool cards (`<Card theme="dark" hover>`).

---

## Batch E — Verify + push

### Task 18: Full build + manual smoke

```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -10
```
Zero errors.

Manual smoke (using admin@ximi4ka.ru):
- Import 3 sample tasks via CLI
- `/admin/oge-tasks` shows them as pending
- Approve one
- Login as demo → `/learn/oge` shows new Учёба section
- Open Банк заданий → topic with approved task
- Solve correctly → see green feedback + XP toast
- Check /dashboard — XP increased

Test mode (after approving 30+ tasks via SQL: `UPDATE oge_tasks SET status='approved' LIMIT 30`):
- Start test on "Все темы" / 30q
- Answer all → results page shows score
- Check `oge_test_runs` row updated

### Task 19: Push

```bash
git push origin main
```

Wait Vercel deploy. Verify on https://learn.ximi4ka.ru.

---

## Plan complete

After saved to `docs/plans/2026-05-18-oge-task-bank-plan.md`, dispatch subagent-driven session.
