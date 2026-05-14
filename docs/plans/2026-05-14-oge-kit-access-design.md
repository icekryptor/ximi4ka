# OGE Kit Access — design doc

Date: 2026-05-14
Status: approved
Scope: XimiLearn (`learn/`)

## Goal

Sell a physical chemistry kit for OGE-2026 prep. Each kit ships with a printed login/password pair that grants 12 months of access to the **OGE module** in XimiLearn. Three integrated tools (lab simulator, periodic table, solubility table) become available to active subscribers. Each account is limited to 3 concurrent devices to prevent credential sharing.

## Three integrated features

```
┌─ Kit credentials ─ CLI generates, admin views
│   └→ creates auth.users (ximi-XXXXXX@kits.ximi4ka.ru) + user_modules entry
│
├─ Email binding ─ optional, in /profile
│   └→ replaces auth.users.email with the user's real email; kit login no longer works
│
├─ Tools (3 HTML iframes wrapped in styled host pages)
│   └→ available only when an active user_modules row exists
│
└─ Device limit (3 concurrent devices, 4th sees "remove one of these")
    └→ user_devices table + device-id middleware enforcement
```

All three are released together as one feature batch.

## Database schema (4 new tables)

```sql
-- modules: catalogue of monetisable units (OGE module today, more later)
modules (
  id           uuid PK default gen_random_uuid(),
  slug         text UNIQUE NOT NULL,        -- 'oge'
  name         text NOT NULL,                -- 'ОГЭ-модуль 2026'
  description  text,
  is_oge       boolean NOT NULL default false,
  created_at   timestamptz default now()
)

-- user_modules: time-bound access grant per user × module
user_modules (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id    uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  granted_at   timestamptz NOT NULL default now(),
  expires_at   timestamptz NOT NULL,
  source       text NOT NULL CHECK (source IN ('kit','paid','admin')),
  PRIMARY KEY (user_id, module_id)
)

-- kit_batches: one row per "Batch #N of 50 codes for module X"
kit_batches (
  id              uuid PK default gen_random_uuid(),
  name            text NOT NULL,            -- 'OGE Batch 2026-05'
  module_id       uuid NOT NULL REFERENCES modules(id),
  count           int NOT NULL,
  duration_days   int NOT NULL,             -- 365 for OGE
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz default now()
)

-- kit_credentials: one row per generated login/password pair
kit_credentials (
  id                  uuid PK default gen_random_uuid(),
  batch_id            uuid NOT NULL REFERENCES kit_batches(id) ON DELETE CASCADE,
  login               text UNIQUE NOT NULL, -- 'ximi-A7K2Q9'
  password_plain      text,                  -- temporarily stored for CSV; admin clears after print
  supabase_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_disabled         boolean NOT NULL default false,
  activated_at        timestamptz,           -- NULL until first login
  last_login_at       timestamptz,
  created_at          timestamptz default now()
)

-- user_devices: tracks which devices a user is logged into
user_devices (
  id              uuid PK default gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       text NOT NULL,             -- UUID generated client-side, stored in localStorage
  user_agent      text,
  last_active_at  timestamptz NOT NULL default now(),
  created_at      timestamptz default now(),
  UNIQUE (user_id, device_id)
)
CREATE INDEX user_devices_active_idx ON user_devices (user_id, last_active_at DESC);
```

**RLS policies:**
- `modules`: read = anyone, write = admin
- `user_modules`: read own only, write = service role only
- `kit_batches`, `kit_credentials`: read/write = admin only
- `user_devices`: read own, write = service role only

## Kit-credential format

| Field | Format | Example |
|---|---|---|
| Login | `ximi-XXXXXX` (6 chars, base32 minus 0/O/1/I/L) | `ximi-A7K2Q9` |
| Password | `XXXX-XXXX` (8 chars in two groups) | `4M9R-T2BK` |
| Supabase email | `<login>@kits.ximi4ka.ru` | `ximi-A7K2Q9@kits.ximi4ka.ru` |

Same alphabet for login and password — avoids ambiguous chars when printed on paper.

## CLI generator

`scripts/generate-kit-batch.ts` (run via `npx tsx`):

```bash
cd learn && npx tsx scripts/generate-kit-batch.ts \
  --module=oge \
  --count=50 \
  --duration=365 \
  --name="OGE Batch 2026-05" \
  --output=batch-001.csv
```

Steps:
1. Look up `modules` by slug, abort if not found.
2. Insert `kit_batches` row, get `batch_id`.
3. Loop `count` times:
   - Generate login + password.
   - `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
   - Insert `kit_credentials` row with `password_plain`.
4. Write CSV with header `Логин,Пароль,QR-ссылка` where QR-link = `https://learn.ximi4ka.ru/kit-login?l=<login>&p=<pwd>`.
5. Prompt `Удалить password_plain из БД? (Y/n)` — on Y, `UPDATE kit_credentials SET password_plain = NULL WHERE batch_id = $1`.

Requires `SUPABASE_SERVICE_ROLE_KEY` env var.

## Activation flow (first kit-login)

1. User opens `/login`, types `ximi-A7K2Q9` + `4M9R-T2BK`. (Or scans QR which auto-fills.)
2. Frontend resolves login to email by appending `@kits.ximi4ka.ru` if input matches `^ximi-[A-Z0-9]{6}$`.
3. Frontend calls custom `POST /api/auth/login` with `{ login, password, device_id }` (device_id from localStorage).
4. Backend:
   - `supabase.auth.signInWithPassword({ email, password })`.
   - On success, look up `kit_credentials` by `supabase_user_id`.
   - If `activated_at IS NULL`:
     - Insert `user_modules` row with `module_id = batch.module_id`, `expires_at = now() + batch.duration_days days`, `source = 'kit'`.
     - `UPDATE kit_credentials SET activated_at = now()`.
   - Update `last_login_at`.
   - Run device-limit check (next section).
5. Set Supabase auth cookies, return success → frontend redirects to `/dashboard`.

If kit row has `is_disabled = true` → 403 with message "Этот код заблокирован, обратитесь в поддержку".

## Email binding (`/profile/bind-email`)

UI: profile shows banner if user's email ends in `@kits.ximi4ka.ru`:
> "Привяжи свою почту, чтобы восстанавливать пароль и получать уведомления"

Click → form → POST `/api/profile/bind-email` `{ email }`:
1. Validate email format, check it doesn't already exist in `auth.users`.
2. `supabase.auth.admin.updateUserById(userId, { email, email_confirm: false })`.
3. Supabase sends confirmation email automatically.
4. Return success → frontend shows "Подтверди ссылку в письме".
5. After user clicks link, Supabase changes the canonical email. Old kit-login `ximi-XXXXXX` no longer works for login.
6. UI replaces banner with "С этого момента вход по `user@example.com`" and a small note about old kit-login.

Password recovery for users with bound email: standard Supabase reset (existing `/forgot-password` page).

For users without bound email: "Обратитесь в поддержку". Acceptable for v1.

## Tools (3 HTML iframes)

**Files placed at `learn/public/tools/`:**
- `oge-lab.html` — лабораторный тренажёр ОГЭ
- `periodic-table.html` — таблица Менделеева  
- `solubility.html` — таблица растворимости

(Files copied verbatim from user's desktop. Each is self-contained: HTML + inline CSS + inline JS, supports `prefers-color-scheme: dark` natively.)

**Routes:**
```
/tools                     — lobby (3 cards, public)
/tools/lab                 — host for oge-lab.html (gated)
/tools/periodic            — host for periodic-table.html (gated)
/tools/solubility          — host for solubility.html (gated)
```

These live under `(learn)` route group → wrapped in dark-theme layout.

**Lobby behaviour:**
- Anyone can visit `/tools` and see 3 preview cards (icon + name + description).
- Click on a card:
  - If user has active `user_modules` row → navigate to tool page.
  - If not → modal: "Тулы доступны только подписчикам ОГЭ-модуля. [Купить набор →]" linking to `/pricing`.

**Host page (same template for all 3):**
```tsx
<Breadcrumbs items={[{ label: 'Тулы', href: '/tools' }, { label: <name>, href: <route> }]} />
<h1 className="font-display text-3xl mb-4 text-dark-text">{name}</h1>
<iframe 
  src="/tools/<file>.html"
  className="w-full h-[calc(100vh-200px)] rounded-2xl border border-white/[0.08] bg-white"
  title={name}
/>
```

Iframe stays in its native light theme — visually a "content card" on the dark learn-zone background. No theme injection.

## Device limit (3 concurrent devices)

**Client (`learn/src/lib/device-id.ts`):**
```ts
export function getDeviceId(): string {
  let id = localStorage.getItem('xim_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('xim_device_id', id);
  }
  return id;
}
```

**Login flow (custom `POST /api/auth/login`):**
1. Authenticate via Supabase.
2. Query `user_devices` for this user where `last_active_at > now() - interval '30 days'`.
3. Count distinct `device_id`.
4. If incoming `device_id` is new AND active count >= 3:
   - Sign out the just-created session immediately.
   - Return `409 DEVICE_LIMIT_EXCEEDED` with body `{ devices: [{ id, label, last_active_at }] }`.
5. Otherwise: `INSERT ... ON CONFLICT (user_id, device_id) DO UPDATE SET last_active_at = now()`.
6. Set device_id as a HttpOnly cookie too (for middleware enforcement).

**UI on 4th device:**
Modal over login form:
```
Уже залогинено 3 устройства
Удалите одно из них, чтобы войти:

□ Chrome on macOS · 15 минут назад        [Удалить]
□ Safari on iPhone · 2 часа назад         [Удалить]
□ Firefox on Windows · вчера              [Удалить]

[Отмена]
```

Each "Удалить":
1. `DELETE /api/devices/:id` — admin-API removes `user_devices` row.
2. Server-side `supabase.auth.admin.signOut(userId, sessionId?)` to invalidate any tokens.
3. On success → automatically retry the original login from current device.

User-agent labels parsed via `ua-parser-js` server-side: e.g. `Chrome on macOS`, `Safari on iPhone`.

**Profile page `/profile/devices`:**
- List own `user_devices`, current device marked "Это устройство".
- "Удалить" button on each (current → causes logout).

**Middleware enforcement:**
- On every authenticated request, middleware checks `device_id` cookie matches an existing `user_devices` row for the user.
- If row missing (deleted by another device) → respond 401, clear cookies, frontend redirects to login.
- Throttle `last_active_at` updates to once per hour per device to avoid write spam.

**Sliding 30-day window:**
- A device with `last_active_at < now() - 30 days` no longer counts toward the 3-device limit.
- Stale rows are kept for audit but ignored for enforcement.
- Optional cleanup cron (later) — out of scope for v1.

## Admin UI

**`/admin/kits` (list):**
| Партия | Модуль | Создан | Активировано | |
|---|---|---|---|---|
| OGE Batch 2026-05 | ОГЭ | 14.05.2026 | 12 / 50 | → |
| OGE Batch 2026-04 | ОГЭ | 28.04.2026 | 47 / 50 | → |

Footer: "💡 Новые батчи создаются через CLI: `npx tsx scripts/generate-kit-batch.ts --help`"

**`/admin/kits/[id]` (batch detail):**
- Header: name, module, duration, count.
- Stats: X of Y activated.
- Buttons: `Скачать CSV (только не активированные)`, `Удалить партию` (disabled if any activations exist).
- Table: each `kit_credentials` row — login, activated_at, current email (if email-bound), expires_at, last_login_at.

No "Create batch" form — CLI only.

## What is intentionally NOT built (YAGNI)

- Bulk operations (extend N users, ban N codes) — done via SQL when needed.
- Email-notification on device kick (passive 401 on next request is fine).
- Analytics dashboards.
- Audit log of admin actions.
- Self-serve password recovery for kit users without bound email (use support).
- Localisation of the 3 HTML tools (already in Russian).
- iframe theme injection (tools stay in their native light theme).

## Backwards compatibility

- `promo_codes` table is left alone — existing promo users keep working.
- `subscriptions` table is left alone — paid Stripe subscribers keep working.
- Gate logic on lessons/modules: `EXISTS subscription WHERE status='active'` OR `EXISTS user_modules WHERE expires_at > now()` — either grants access.

## Implementation order (10 tasks, ~9 hours)

1. **DB schema** — 4 migrations + RLS (30 min)
2. **CLI generator** — `scripts/generate-kit-batch.ts` + CSV (1h)
3. **Kit-login activation** — auto-create `user_modules` on first login (30 min)
4. **Email binding** — `/profile/bind-email` UI + API (45 min)
5. **Device-id middleware** — lib + login flow + middleware enforcement (1.5h)
6. **Device-limit UI** — modal on login + `/profile/devices` (1h)
7. **Tools** — copy 3 HTML, host pages, lobby with previews (45 min)
8. **Subscription gate refactor** — pages now check `user_modules` too (45 min)
9. **Admin /admin/kits** — list + batch detail + CSV export (1.5h)
10. **End-to-end smoke test** — generate, activate, bind email, use tool, hit device limit (30 min)

## Acceptance criteria

- [ ] CLI creates 50 pairs and exports CSV.
- [ ] Kit login `ximi-XXXXXX / XXXX-XXXX` → dashboard, with active OGE module valid until +365 days.
- [ ] User binds email in `/profile`, confirms via Supabase email link, next login uses real email.
- [ ] `/tools` lobby shows 3 cards. Subscriber clicks → iframe loads. Anonymous clicks → CTA modal.
- [ ] 4th device login shows "remove one of 3" modal. Removing one allows new login. Old device gets 401 on next request.
- [ ] Admin `/admin/kits` lists batches and shows activation status per credential.
- [ ] Old promo codes and Stripe subscriptions still work.
