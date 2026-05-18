# OGE Task Bank + Practice/Test Modes — design doc

Date: 2026-05-18
Status: approved (delegated past section 2)
Scope: XimiLearn (`learn/`) — adds content to OGE module

## Goal

Add two content surfaces to the OGE module:
1. **Банк заданий** — practice mode, student picks a topic and solves tasks one at a time with instant feedback
2. **Контрольный тест** — 30 or 50 question test on a chosen topic (or all topics), scored at the end with error breakdown

Content sourced from two pipelines:
- **Import** of open OGE collections (JSON)
- **AI generation** (Claude API) — both flagged for chemist review before going live

## Decisions captured from brainstorm

| Q | Answer |
|---|---|
| Content source | Hybrid: bulk import + AI generation, both with chemist fact-check workflow |
| Question types | Single-choice, multi-choice, matching (defer text input + lab integration) |
| Modes | Practice (instant feedback) + Test (30-50q with score at end). Defer full exam simulation. |
| XP | Practice: 10 XP per correct. Test: 5 XP per correct + 50 XP completion bonus. |
| Placement | Two new cards in `/learn/oge` (Банк заданий, Контрольный тест) |

## Architecture

```
┌─ Content pipeline ────────────────────────────────┐
│  Import script (CLI)  ──┐                         │
│                         ├─→  status='pending_review'│
│  AI generator (admin)  ──┘                         │
│                                ↓                   │
│                       Chemist in /admin/oge-tasks  │
│                       approves / edits / rejects   │
│                                ↓                   │
│                          status='approved'         │
│                                ↓                   │
│                       Visible to students          │
└────────────────────────────────────────────────────┘

┌─ Student UX ──────────────────────────────────────┐
│  /learn/oge   (existing — adds 2 more tool cards) │
│   ├── 📚 Банк заданий   → /learn/oge/bank        │
│   │     ↳ topic list → /learn/oge/bank/[topic]   │
│   │       (next unattempted task, instant fb)     │
│   └── 📝 Контрольный тест → /learn/oge/test      │
│         ↳ pick topic + 30/50 → /learn/oge/test/[runId]│
│           (no hints, navigation forward only)     │
│           ↳ end → results screen with breakdown   │
└────────────────────────────────────────────────────┘
```

## Database schema (migration `011_oge_task_bank.sql`)

4 new tables — topics, tasks (with status + source meta), attempts, test runs.

```sql
CREATE TABLE oge_topics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  exam_tasks  TEXT,                              -- '1, 2'
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE oge_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id        UUID NOT NULL REFERENCES oge_topics(id),
  type            TEXT NOT NULL CHECK (type IN ('single', 'multi', 'matching')),
  difficulty      INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct         JSONB NOT NULL,
  explanation     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review','approved','rejected','archived')),
  source          TEXT NOT NULL CHECK (source IN ('imported','ai_generated','manual')),
  source_meta     JSONB,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX oge_tasks_status_topic_idx ON oge_tasks (status, topic_id);
CREATE INDEX oge_tasks_difficulty_idx   ON oge_tasks (difficulty) WHERE status = 'approved';

CREATE TABLE oge_task_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES oge_tasks(id) ON DELETE CASCADE,
  mode         TEXT NOT NULL CHECK (mode IN ('practice', 'test')),
  test_run_id  UUID,
  answer       JSONB NOT NULL,
  is_correct   BOOLEAN NOT NULL,
  time_spent_ms INTEGER,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX oge_attempts_user_idx ON oge_task_attempts (user_id, attempted_at DESC);
CREATE INDEX oge_attempts_test_idx ON oge_task_attempts (test_run_id) WHERE test_run_id IS NOT NULL;

CREATE TABLE oge_test_runs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id     UUID REFERENCES oge_topics(id),
  questions_n  INTEGER NOT NULL,
  correct_n    INTEGER NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  score_pct    INTEGER
);
CREATE INDEX oge_test_runs_user_idx ON oge_test_runs (user_id, started_at DESC);

-- RLS
ALTER TABLE oge_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE oge_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oge_task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oge_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads topics" ON oge_topics FOR SELECT USING (true);
CREATE POLICY "Students read approved tasks" ON oge_tasks FOR SELECT USING (
  status = 'approved' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users see own attempts" ON oge_task_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own test runs" ON oge_test_runs FOR SELECT USING (auth.uid() = user_id);

-- Seed 11 topics
INSERT INTO oge_topics (slug, name, exam_tasks, order_index) VALUES
  ('atomistics',        'Атомистика и Периодическая система',     '1, 2',     0),
  ('chemical-bond',     'Химическая связь',                        '3',        1),
  ('oxidation-states',  'Степени окисления',                       '4',        2),
  ('substance-structure','Строение веществ',                       '5',        3),
  ('classification',    'Классификация веществ',                   '6',        4),
  ('electrolytes',      'Электролиты и ионы',                      '7, 8',     5),
  ('reactions',         'Реакции',                                 '9-12',     6),
  ('acids-bases-salts', 'Кислоты, щёлочи, соли',                   '13-15',    7),
  ('qualitative',       'Качественные реакции',                    '16, 17',   8),
  ('calculations',      'Расчёты',                                 '18, 19',   9),
  ('mixtures',          'Чистые вещества и смеси',                 '20-22',    10);
```

XP for solved tasks writes to existing `task_attempts` table with `source='oge_practice'` or `source='oge_test'` and `tool_meta = { task_id, mode, test_run_id }`. This keeps `getUserStats.totalXp` (which sums from `task_attempts.points_earned`) working — ranks update automatically.

## Content workflow

### Import (CLI)

`scripts/import-oge-bank.ts`:
- Reads JSON file with task array
- Resolves `topic` slug → `topic_id`
- Validates each task structure
- Inserts with `status='pending_review'`, `source='imported'`, `source_meta={ batch_id, source_name, original_id? }`
- Prints summary: N inserted, M skipped (validation failed)

Input format:
```json
[
  {
    "topic": "atomistics",
    "type": "single",
    "difficulty": 2,
    "question": "Элемент в III периоде, V группе главной подгруппы — это…",
    "options": ["P", "N", "As", "Sb"],
    "correct": 0,
    "explanation": "Атом фосфора имеет конфигурацию [Ne] 3s² 3p³…"
  }
]
```

### AI generation

`/api/admin/oge-tasks/generate` (POST, admin-only):
- Request: `{ topic_slug, type, difficulty, count: 10 }`
- Calls Anthropic Claude Sonnet 4 with a strict system prompt
- Parses JSON response, validates, inserts with `status='pending_review'`, `source='ai_generated'`, `source_meta={ model, prompt_v }`
- Returns: `{ inserted: 10, errors: [] }`

Admin UI: button "✨ Сгенерить 10 заданий" on the review page; opens modal to pick topic/type/difficulty.

Requires env var `ANTHROPIC_API_KEY` in Vercel.

### Chemist review

`/admin/oge-tasks`:
- Filter: status (default pending_review), topic, type, source
- Each row: question preview, type/difficulty pill, source badge, action buttons:
  - **✓ Одобрить** — `status='approved'`, sets reviewed_by + reviewed_at
  - **✏️ Редактировать** — opens edit form (inline or modal)
  - **✗ Отклонить** — `status='rejected'` + optional reviewer_notes
- Stats sidebar: counts by status per topic; "Всего одобрено / в проверке / отклонено"

## Practice mode UX (`/learn/oge/bank`)

**Lobby page:**
- 11 topic cards in grid
- Each card: name, "ОГЭ задания 1-2", `X из Y решено` progress, "Перейти →"
- Bottom: "Перейти в случайную тему" button

**Solving page `/learn/oge/bank/[topic-slug]`:**
- Header: topic name + breadcrumb back to bank
- Card: question text + answer UI per type (radio buttons for single, checkboxes for multi, drag/dropdown for matching)
- "Проверить" button → submit
- After submit:
  - Green/red feedback border
  - Highlighted correct option(s)
  - Explanation text expanded below
  - "Следующее задание →" (or "Закончить" if all solved)
- Sidebar/top: "Прогресс: 7/24"
- XP: +10 per correct, recorded to `task_attempts` (source='oge_practice') and `oge_task_attempts` (mode='practice')
- Next task selection: prefer unattempted, then attempted-but-wrong, then random approved task of this topic

**Empty topic:** if 0 approved tasks → "Скоро здесь будут задания, заходи позже!" CTA

## Test mode UX (`/learn/oge/test`)

**Lobby:**
- Header: "Контрольный тест по химии ОГЭ"
- Form:
  - Тема: dropdown с 11 темами + "Все темы"
  - Количество вопросов: 30 / 50 buttons
- "Начать тест" button
- Below: "История ваших тестов" — table of past `oge_test_runs` with score, topic, date

**Test page `/learn/oge/test/[runId]`:**
- Top bar: "Вопрос 7 из 30" + progress bar + текущая тема (if scoped)
- Card with question + answer UI (same components as practice)
- "Следующий" button only — no going back
- No instant feedback during test
- On finish (last question submitted) → redirect to results page

**Results page `/learn/oge/test/[runId]/result`:**
- Big score: "73% — 22 из 30 правильно"
- Breakdown by topic (if multi-topic) or by difficulty
- "Разобрать ошибки" toggle → shows incorrect questions with correct answer + explanation
- XP awarded: `5 * correct_n + 50` if finished, recorded once
- "Запустить ещё раз" CTA → new test_run with same params

## Placement in OGE module

`/learn/oge` already shows 3 tool cards (lab, periodic, solubility). Add 2 more:

```
┌──────────────────────────────────────────┐
│ ОГЭ-модуль 2026                          │
│                                           │
│ Инструменты                              │
│ [Лаба] [Менделеев] [Растворимость]      │
│                                           │
│ Учёба                                    │
│ [📚 Банк заданий] [📝 Контрольный тест] │
└──────────────────────────────────────────┘
```

Wrap inside `(learn)/learn/oge` page — already handles dark theme.

## XP & gamification integration

- Every correct practice answer: insert into `task_attempts` with `points_earned=10`, `source='oge_practice'`, `tool_meta={task_id, topic_slug}`
- Test completion: insert ONE row with `points_earned = 5*correct + 50`, `source='oge_test'`, `tool_meta={test_run_id, score_pct}`
- These XP feed into existing `getUserStats.totalXp` → ranks update → discounts update automatically
- Dashboard "Recent activity" picks up these attempts via existing query

## Admin UI additions

| Page | Purpose |
|---|---|
| `/admin/oge-tasks` | Review queue + filter + AI-generate button |
| `/admin/oge-tasks/[id]` | Edit single task (or use modal in list) |
| `/admin/oge-topics` | (optional) Edit topic names — defer if seed is enough |

Add to admin sidebar nav: `Задания ОГЭ`.

## Files affected

| File | Action |
|---|---|
| `learn/supabase/migrations/011_oge_task_bank.sql` | NEW |
| `learn/src/lib/oge-tasks.ts` | NEW — validators, fetchers, attempt recording |
| `learn/scripts/import-oge-bank.ts` | NEW — CLI |
| `learn/src/app/api/admin/oge-tasks/generate/route.ts` | NEW — AI-gen endpoint |
| `learn/src/app/api/oge-tasks/attempt/route.ts` | NEW — record student attempt + XP |
| `learn/src/app/api/oge-tasks/test/start/route.ts` | NEW — create test_run, pick questions |
| `learn/src/app/api/oge-tasks/test/finish/route.ts` | NEW — compute score, award XP |
| `learn/src/app/(learn)/learn/oge/page.tsx` | MODIFY — add Учёба section with 2 cards |
| `learn/src/app/(learn)/learn/oge/bank/page.tsx` | NEW — topic lobby |
| `learn/src/app/(learn)/learn/oge/bank/[topic]/page.tsx` | NEW — solving |
| `learn/src/app/(learn)/learn/oge/test/page.tsx` | NEW — test lobby + history |
| `learn/src/app/(learn)/learn/oge/test/[id]/page.tsx` | NEW — test runner |
| `learn/src/app/(learn)/learn/oge/test/[id]/result/page.tsx` | NEW — results |
| `learn/src/components/oge/QuestionCard.tsx` | NEW — shared single/multi/matching renderer |
| `learn/src/app/(admin)/admin/oge-tasks/page.tsx` | NEW — review queue |
| `learn/src/app/(admin)/admin/oge-tasks/[id]/page.tsx` | NEW — edit |
| `learn/src/app/(admin)/layout.tsx` | MODIFY — add nav link |

## Env vars needed

- `ANTHROPIC_API_KEY` — required for AI generation. Add to Vercel before first AI call (without it endpoint returns 503).

## What's out of scope

- Text input (chemical formulas) — defer
- Lab integration for task-23 — defer
- Full exam simulation with timer — defer
- Adaptive difficulty / spaced repetition — defer
- Image/diagram attachments to questions — defer (use plain text + ASCII formulas with sub/sup for now)
- Per-difficulty XP weighting — keep flat 10 XP for practice
- Public sharing of test results — defer
- Localization beyond Russian — n/a

## Acceptance

- [ ] Migration applied, 11 topics seeded
- [ ] CLI import works with sample JSON (5-10 tasks)
- [ ] AI generation produces 10 tasks marked pending_review for chosen topic (requires API key)
- [ ] Admin review queue lets chemist approve/edit/reject
- [ ] Student sees only approved tasks in /learn/oge/bank
- [ ] Practice mode: solve task, see feedback, get XP, ranks update
- [ ] Test mode: start 30q test, answer all, see results with score + error review
- [ ] Test XP awarded once on completion, visible in /dashboard
- [ ] /admin sidebar has "Задания ОГЭ" link
