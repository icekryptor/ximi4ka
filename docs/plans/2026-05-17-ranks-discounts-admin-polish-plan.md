# Ranks, Discounts & Admin Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add XP-based ranks (Новичок → Бронза → Серебро → Золото → Платина → Алмаз) with matching subscription discounts (0/3/5/8/10/12%); display rank+achievements prominently in profile and header; polish admin (logout button + richer dashboard + padding sweep).

**Architecture:** Ranks are pure derivations from `total_xp` (no schema change for rank itself); a small audit migration adds `base_amount`/`discount_pct`/`rank_at_purchase` to `subscriptions` for transparency on what discount was applied at purchase time. Discount applies ONLY to platform-side subscription renewals through `/pricing`; Tilda kit checkout is untouched. Admin is polished in a separate batch (no DB changes there).

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Auth), TypeScript, Tailwind, lucide-react.

**Reference design doc:** `docs/plans/2026-05-17-ranks-discounts-admin-polish-design.md`

**Working directory:** `/Users/vasilijaistov/Desktop/continuum/ximi4ka/learn`

**Verification after each batch:** `cd learn && npm run build` must succeed (zero ESLint errors).

---

## Task 1: DB migration for subscription audit columns

**Files:**
- Create: `learn/supabase/migrations/010_subscription_discount.sql`

**Step 1:** Write the migration file:

```sql
-- 010_subscription_discount.sql
-- Audit columns: capture which discount was applied when a subscription was paid for.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_pct INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_at_purchase TEXT;

CREATE INDEX IF NOT EXISTS subscriptions_rank_idx ON subscriptions (rank_at_purchase) WHERE rank_at_purchase IS NOT NULL;
```

**Step 2:** Apply via Supabase MCP `apply_migration` with project_id `ovbqcfhecftjfejtxsas`, name `010_subscription_discount`, query = file contents.

**Step 3:** Verify:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'subscriptions' AND column_name IN ('base_amount','discount_pct','rank_at_purchase');
```
Expected: 3 rows.

**Step 4:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add supabase/migrations/010_subscription_discount.sql
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(db): subscription audit cols for rank-based discounts"
```

---

## Task 2: Ranks library (pure functions)

**Files:**
- Create: `learn/src/lib/ranks.ts`

**Step 1:** Write the entire library:

```typescript
import { Sparkles, Award, Medal, Trophy, Crown, Gem, type LucideIcon } from "lucide-react";

export type RankKey = "novice" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface RankDef {
  key: RankKey;
  name: string;       // Russian label
  minXp: number;
  color: string;      // tailwind class fragment OR hex
  hex: string;        // raw hex for inline styles
  Icon: LucideIcon;
  discountPct: number;
}

export const RANKS: RankDef[] = [
  { key: "novice",   name: "Новичок", minXp: 0,    color: "text-gray-400",   hex: "#9ca3af", Icon: Sparkles, discountPct: 0  },
  { key: "bronze",   name: "Бронза",  minXp: 500,  color: "text-amber-600",  hex: "#b45309", Icon: Award,    discountPct: 3  },
  { key: "silver",   name: "Серебро", minXp: 1000, color: "text-slate-400",  hex: "#94a3b8", Icon: Medal,    discountPct: 5  },
  { key: "gold",     name: "Золото",  minXp: 2000, color: "text-yellow-500", hex: "#eab308", Icon: Trophy,   discountPct: 8  },
  { key: "platinum", name: "Платина", minXp: 4000, color: "text-cyan-400",   hex: "#22d3ee", Icon: Crown,    discountPct: 10 },
  { key: "diamond",  name: "Алмаз",   minXp: 6000, color: "text-violet-400", hex: "#a78bfa", Icon: Gem,      discountPct: 12 },
];

export interface RankState {
  rank: RankDef;
  nextRank: RankDef | null;
  xpToNext: number;        // 0 when at top rank
  progressPct: number;     // 0..100, progress within current rank tier
}

export function getRankState(totalXp: number): RankState {
  // Find current rank: highest minXp <= totalXp
  let current: RankDef = RANKS[0];
  for (const r of RANKS) {
    if (totalXp >= r.minXp) current = r;
  }
  const idx = RANKS.findIndex(r => r.key === current.key);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const xpToNext = next ? Math.max(0, next.minXp - totalXp) : 0;
  const progressPct = next
    ? Math.min(100, Math.round(((totalXp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;
  return { rank: current, nextRank: next, xpToNext, progressPct };
}

export function applyDiscount(baseAmount: number, discountPct: number): number {
  return Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100;
}
```

**Step 2:** Build to verify TS compiles:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/lib/ranks.ts
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(ranks): pure ranks library — thresholds + discount lookup"
```

---

## Task 3: Server helper — get user's total XP + rank state

**Files:**
- Create: `learn/src/lib/user-rank.ts`

**Step 1:** Write helper that fetches XP server-side and returns rank state:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { getRankState, type RankState } from "./ranks";

export async function getUserTotalXp(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from("task_attempts")
    .select("points_earned")
    .eq("user_id", userId);
  return (data ?? []).reduce((sum, a) => sum + (a.points_earned ?? 0), 0);
}

export async function getUserRankState(supabase: SupabaseClient, userId: string): Promise<{ totalXp: number; state: RankState }> {
  const totalXp = await getUserTotalXp(supabase, userId);
  return { totalXp, state: getRankState(totalXp) };
}
```

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -3
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/lib/user-rank.ts
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(ranks): server helper to fetch user's XP and rank state"
```

---

## Task 4: RankCard component for profile

**Files:**
- Create: `learn/src/components/profile/RankCard.tsx`

**Step 1:** Write the component:

```tsx
import type { RankState } from "@/lib/ranks";

interface Props {
  totalXp: number;
  state: RankState;
}

export function RankCard({ totalXp, state }: Props) {
  const { rank, nextRank, xpToNext, progressPct } = state;
  const Icon = rank.Icon;
  return (
    <div className="rounded-2xl bg-dark-surface border border-white/[0.08] p-6">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${rank.hex}1f`, color: rank.hex }}
        >
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-dark-text-muted uppercase tracking-wide mb-1">Твой ранг</p>
          <h2 className="font-display text-2xl font-bold text-dark-text leading-tight">
            {rank.name}
          </h2>
          {rank.discountPct > 0 && (
            <span
              className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: `${rank.hex}1f`, color: rank.hex }}
            >
              Скидка {rank.discountPct}%
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-2xl font-bold text-dark-text tabular-nums">{totalXp}</p>
          <p className="text-xs text-dark-text-muted">XP</p>
        </div>
      </div>

      {nextRank ? (
        <>
          <div className="relative h-2 w-full rounded-full bg-white/[0.05] overflow-hidden mb-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: rank.hex }}
            />
          </div>
          <p className="text-xs text-dark-text-secondary">
            До ранга <span className="font-semibold text-dark-text">{nextRank.name}</span>:{" "}
            <span className="font-mono text-dark-text tabular-nums">{xpToNext} XP</span>
          </p>
        </>
      ) : (
        <p className="text-xs text-dark-text-secondary">
          Максимальный ранг достигнут 💎
        </p>
      )}
    </div>
  );
}
```

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -3
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/components/profile/RankCard.tsx
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(profile): RankCard with icon, XP, progress bar, discount badge"
```

---

## Task 5: AchievementsCard component for profile

**Files:**
- Create: `learn/src/components/profile/AchievementsCard.tsx`

**Step 1:** Write component:

```tsx
import Link from "next/link";
import { Trophy } from "lucide-react";

interface UserAch {
  id: string;
  earned_at: string;
  achievements?: { title?: string; description?: string; icon_url?: string };
}

interface Props {
  earned: UserAch[];
  totalAvailable: number;
}

export function AchievementsCard({ earned, totalAvailable }: Props) {
  const recent = earned.slice(0, 6);
  return (
    <div className="rounded-2xl bg-dark-surface border border-white/[0.08] p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-dark-text-muted uppercase tracking-wide mb-1">Достижения</p>
          <h2 className="font-display text-2xl font-bold text-dark-text">
            <span className="text-primary">{earned.length}</span>
            <span className="text-dark-text-muted text-lg"> / {totalAvailable}</span>
          </h2>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-dark-text-muted mb-4 flex-1">
          Решай задачи, чтобы получать ачивки. Первая ждёт тебя за первый правильный ответ.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-4 flex-1">
          {recent.map((ua) => (
            <div
              key={ua.id}
              title={`${ua.achievements?.title ?? ""} — ${ua.achievements?.description ?? ""}`}
              className="aspect-square rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-2xl"
            >
              {ua.achievements?.icon_url || "🏆"}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/achievements"
        className="text-sm text-primary hover:text-primary-hover transition-colors mt-auto"
      >
        Смотреть все →
      </Link>
    </div>
  );
}
```

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -3
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/components/profile/AchievementsCard.tsx
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(profile): AchievementsCard with earned/total + recent grid"
```

---

## Task 6: Wire RankCard + AchievementsCard into /profile

**Files:**
- Modify: `learn/src/app/(learn)/profile/page.tsx`

**Step 1:** READ the current file. It's a client component using `useEffect` to load profile/subscription. Need to also load XP and achievements there.

**Step 2:** At the top of `load()`, after fetching `user`, add three more queries (using the existing `supabase` client variable):

```typescript
const [{ data: attempts }, { data: ua }, { count: totalAch }] = await Promise.all([
  supabase.from("task_attempts").select("points_earned").eq("user_id", user.id),
  supabase
    .from("user_achievements")
    .select("id, earned_at, achievements(title, description, icon_url)")
    .eq("user_id", user.id)
    .order("earned_at", { ascending: false }),
  supabase.from("achievements").select("*", { count: "exact", head: true }),
]);
const xp = (attempts ?? []).reduce((s, a) => s + (a.points_earned ?? 0), 0);
setTotalXp(xp);
setUserAchievements(ua ?? []);
setTotalAchCount(totalAch ?? 0);
```

**Step 3:** Add the state hooks at top:
```typescript
import { getRankState } from "@/lib/ranks";
import { RankCard } from "@/components/profile/RankCard";
import { AchievementsCard } from "@/components/profile/AchievementsCard";

const [totalXp, setTotalXp] = useState(0);
const [userAchievements, setUserAchievements] = useState<any[]>([]);
const [totalAchCount, setTotalAchCount] = useState(0);
```

**Step 4:** In render, ABOVE the existing `BindEmailBanner`, insert:

```tsx
<div className="grid md:grid-cols-2 gap-4 mb-6">
  <RankCard totalXp={totalXp} state={getRankState(totalXp)} />
  <AchievementsCard earned={userAchievements} totalAvailable={totalAchCount} />
</div>
```

**Step 5:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 6:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add 'src/app/(learn)/profile/page.tsx'
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(profile): render RankCard + AchievementsCard above existing sections"
```

---

## Task 7: Rank chip in ProfilePreview header

**Files:**
- Modify: `learn/src/components/layout/ProfilePreview.tsx`

**Step 1:** Convert to fetch XP server-side via `getUserTotalXp` and compute rank. Add chip BEFORE the avatar link:

```tsx
import { getRankState } from "@/lib/ranks";
import { getUserTotalXp } from "@/lib/user-rank";
// ... existing imports

// inside the async function, after fetching profile:
const totalXp = await getUserTotalXp(supabase, user.id);
const { rank } = getRankState(totalXp);
const Icon = rank.Icon;

// In the return JSX, add as the first child of the outer flex:
<div
  className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
  style={{ background: `${rank.hex}1f`, color: rank.hex }}
  title={`${rank.name}${rank.discountPct ? ` · скидка ${rank.discountPct}%` : ''}`}
>
  <Icon className="w-3.5 h-3.5" />
  <span>{rank.name}</span>
</div>
```

Place it right before the existing `<a>` for telegram (or before the profile Link if no telegram).

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -3
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/components/layout/ProfilePreview.tsx
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(header): rank chip beside avatar in ProfilePreview"
```

---

## Task 8: Apply rank discount on /pricing page

**Files:**
- Modify: `learn/src/app/(public)/pricing/page.tsx`

**Step 1:** READ the file. Current is likely a Server Component with hardcoded prices. We'll fetch the user (if logged in), compute rank, and show discounted prices.

Make it async server component. After existing imports, add:
```tsx
import { createClient } from "@/lib/supabase/server";
import { getUserTotalXp } from "@/lib/user-rank";
import { getRankState, applyDiscount } from "@/lib/ranks";
```

At top of component function:
```tsx
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
let rankState = getRankState(0);
let totalXp = 0;
if (user) {
  totalXp = await getUserTotalXp(supabase, user.id);
  rankState = getRankState(totalXp);
}
const discount = rankState.rank.discountPct;
const Icon = rankState.rank.Icon;
```

**Step 2:** Above the plan cards, render a banner when `discount > 0`:

```tsx
{discount > 0 && (
  <div
    className="rounded-2xl p-4 mb-6 flex items-center gap-3 border"
    style={{ background: `${rankState.rank.hex}1f`, borderColor: `${rankState.rank.hex}40` }}
  >
    <Icon className="w-6 h-6 flex-shrink-0" style={{ color: rankState.rank.hex }} />
    <div>
      <p className="text-sm text-text-primary">
        <strong>Твой ранг:</strong> {rankState.rank.name}
      </p>
      <p className="text-xs text-text-secondary">
        Действует скидка <strong>{discount}%</strong> на все подписки. Применяется автоматически.
      </p>
    </div>
  </div>
)}
```

**Step 3:** For each pricing card, where you show the price (e.g. 999 ₽), wrap as:
```tsx
{discount > 0 ? (
  <div className="flex items-baseline gap-2">
    <span className="text-text-muted line-through text-lg">{basePrice} ₽</span>
    <span className="text-primary font-bold text-3xl">{applyDiscount(basePrice, discount)} ₽</span>
    <span className="text-xs text-primary font-semibold">−{discount}%</span>
  </div>
) : (
  <span className="text-text-primary font-bold text-3xl">{basePrice} ₽</span>
)}
```

(Adapt class names to match existing card structure. Replace each price occurrence; common ones are 999 and 499.)

**Step 4:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 5:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add 'src/app/(public)/pricing/page.tsx'
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(pricing): show rank-based discount banner + struck prices when logged in"
```

---

## Task 9: Apply discount in /api/payments/create

**Files:**
- Modify: `learn/src/app/api/payments/create/route.ts`

**Step 1:** READ the current file. Replace the hardcoded amount calculation with rank-aware:

```ts
import { getUserTotalXp } from "@/lib/user-rank";
import { getRankState, applyDiscount } from "@/lib/ranks";

// inside POST handler, after auth check:
const totalXp = await getUserTotalXp(supabase, user.id);
const { rank } = getRankState(totalXp);

// existing promo lookup stays:
const { data: promo } = await supabase
  .from("promo_codes")
  .select("*")
  .eq("used_by", user.id)
  .maybeSingle();   // .maybeSingle (not .single) to avoid 406 on no rows

const baseAmount = promo ? 499 : 999;
const finalAmount = applyDiscount(baseAmount, rank.discountPct);
const subscriptionPlan = promo ? "base_promo" : "base";

const payment = await createPayment({
  amount: finalAmount,
  description: `Подписка XimiLearn — ${finalAmount} ₽/мес (${rank.name}, скидка ${rank.discountPct}%)`,
  returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
  metadata: {
    user_id: user.id,
    type: "subscription",
    plan: subscriptionPlan,
    base_amount: baseAmount,
    discount_pct: rank.discountPct,
    rank_at_purchase: rank.key,
  },
});
```

Also: ensure that the webhook handler `/api/payments/webhook/route.ts` (if it stores subscription on confirmation) reads `metadata.base_amount`, `metadata.discount_pct`, `metadata.rank_at_purchase` and writes to the new columns. READ that file and add the writes if applicable.

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/app/api/payments/
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(payments): apply rank discount to subscription price + audit metadata"
```

---

## Task 10: Admin — logout button

**Files:**
- Modify: `learn/src/app/(admin)/layout.tsx`

**Step 1:** The layout is currently a server component. To use signOut we need a small client component for the logout button.

Create `learn/src/components/admin/AdminLogoutButton.tsx`:

```tsx
"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminLogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  async function handle() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={handle}
      className="mt-auto w-full flex items-center gap-2 px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
    >
      <LogOut className="w-4 h-4" />
      Выйти
    </button>
  );
}
```

**Step 2:** Modify `(admin)/layout.tsx`:
- Add `import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";`
- Change `<aside>` to use `flex flex-col` so the logout button can sit at the bottom
- After the existing `<nav>` block, before closing `</aside>`, render `<AdminLogoutButton />`

```tsx
<aside className="w-64 bg-text-primary text-white p-6 flex flex-col">
  <Link href="/admin" className="text-xl font-bold text-primary mb-8 block">
    XimiLearn Admin
  </Link>
  <nav className="space-y-2 flex-1">
    {/* existing links */}
  </nav>
  <AdminLogoutButton />
</aside>
```

**Step 3:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -3
```

**Step 4:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add src/components/admin/AdminLogoutButton.tsx 'src/app/(admin)/layout.tsx'
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(admin): logout button at bottom of sidebar"
```

---

## Task 11: Admin dashboard — richer widgets

**Files:**
- Modify: `learn/src/app/(admin)/admin/page.tsx`

**Step 1:** Replace the page entirely with richer dashboard:

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgoIso = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString();
  const nowIso = now.toISOString();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { count: activeKitAccess },
    { count: totalBatches },
    { count: activatedToday },
    { count: activatedWeek },
    { data: recentUsers },
    { data: recentActivations },
    { data: dailyActivations },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active").gt("expires_at", nowIso),
    supabase.from("user_modules").select("*", { count: "exact", head: true }).gt("expires_at", nowIso),
    supabase.from("kit_batches").select("*", { count: "exact", head: true }),
    supabase.from("kit_credentials").select("*", { count: "exact", head: true }).gte("activated_at", new Date(now.toISOString().slice(0, 10) + "T00:00:00Z").toISOString()),
    supabase.from("kit_credentials").select("*", { count: "exact", head: true }).gte("activated_at", weekAgoIso),
    supabase.from("profiles").select("id, display_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("kit_credentials")
      .select("login, activated_at, assigned_name")
      .not("activated_at", "is", null)
      .order("activated_at", { ascending: false })
      .limit(8),
    supabase.from("kit_credentials")
      .select("activated_at")
      .gte("activated_at", monthAgoIso)
      .not("activated_at", "is", null),
  ]);

  // Bucket daily activations into last-30-days array
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  (dailyActivations ?? []).forEach((row) => {
    const key = (row.activated_at as string).slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.count++;
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const stats = [
    { label: "Учеников", value: totalUsers ?? 0 },
    { label: "Активных подписок", value: activeSubs ?? 0 },
    { label: "Активных kit-доступов", value: activeKitAccess ?? 0 },
    { label: "Партий наборов", value: totalBatches ?? 0 },
    { label: "Активаций · 7 дн", value: activatedWeek ?? 0, sub: `сегодня ${activatedToday ?? 0}` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-text-primary">Дашборд</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-border p-4 text-center">
            <p className="text-3xl font-bold text-primary tabular-nums">{s.value}</p>
            <p className="text-xs text-text-secondary mt-1">{s.label}</p>
            {s.sub && <p className="text-[10px] text-text-muted mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-border p-5 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Активации kit-кодов за 30 дней
        </h2>
        <div className="flex items-end gap-1 h-24">
          {days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.count}`}
              className="flex-1 rounded-t bg-primary/30 hover:bg-primary transition-colors"
              style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-2">
          <span>{days[0].date}</span>
          <span>{days[days.length - 1].date}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-border p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Свежие регистрации</h2>
          {(recentUsers ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">Пока пусто.</p>
          ) : (
            <ul className="space-y-2">
              {recentUsers!.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-sm">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-gradient-start to-primary-gradient-end text-white text-[10px] font-bold flex items-center justify-center">
                      {(u.display_name ?? "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 truncate text-text-primary">{u.display_name ?? "Без имени"}</span>
                  <span className="text-xs text-text-muted">{new Date(u.created_at).toLocaleDateString("ru-RU")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Свежие активации kit-кодов</h2>
            <Link href="/admin/kits" className="text-xs text-primary">Все партии →</Link>
          </div>
          {(recentActivations ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">Пока никто не активировал коды.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivations!.map((c) => (
                <li key={c.login} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-text-secondary">{c.login}</span>
                  <span className="flex-1 truncate text-text-primary">{c.assigned_name ?? "—"}</span>
                  <span className="text-xs text-text-muted">{c.activated_at ? new Date(c.activated_at).toLocaleDateString("ru-RU") : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 3:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add 'src/app/(admin)/admin/page.tsx'
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "feat(admin): richer dashboard — 5 KPIs, 30-day activation chart, recent users/activations"
```

---

## Task 12: Padding sweep across admin pages

**Files:** all `learn/src/app/(admin)/admin/**/page.tsx` and `learn/src/app/(admin)/admin/**/*EditForm.tsx`

**Step 1:** Find pages with inconsistent padding:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && grep -rln "^import\|^export" 'src/app/(admin)' | xargs grep -l "p-[0-9]\|px-\|py-" 2>/dev/null | head -20
```

**Step 2:** Normalize: every admin page's outer wrapper should be just `<div>` (NOT `<div className="p-6">` etc.) since the admin LAYOUT (`(admin)/layout.tsx` main) already adds `p-8`.

For each admin page: REMOVE any outer `className="p-..."` wrapper since the layout provides padding. Keep h1 spacing.

Visit these and fix outer wrapper:
- `learn/src/app/(admin)/admin/kits/page.tsx`
- `learn/src/app/(admin)/admin/kits/[id]/page.tsx`
- `learn/src/app/(admin)/admin/modules/page.tsx`
- `learn/src/app/(admin)/admin/modules/[id]/page.tsx`
- `learn/src/app/(admin)/admin/promo/page.tsx`
- `learn/src/app/(admin)/admin/users/page.tsx`
- `learn/src/app/(admin)/admin/achievements/page.tsx`

For each: open file, if outer container has `p-6` or similar, remove it. The layout's `p-8` is enough.

**Step 3:** Verify h1 spacing — every page should have:
```tsx
<h1 className="text-2xl font-bold mb-6 text-text-primary">…</h1>
```

If any uses `mb-4` or different, change to `mb-6`. If text color isn't `text-text-primary`, add it.

**Step 4:** Build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -5
```

**Step 5:** Visual smoke test — open each admin page in browser and confirm spacing looks consistent.

**Step 6:** Commit:
```bash
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn add -u
git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn commit -m "fix(admin): remove duplicate outer padding (layout provides p-8); normalize h1 mb-6"
```

---

## Task 13: Final verification + push

**Step 1:** Run full build:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run build 2>&1 | tail -10
```

**Step 2:** Grep for forbidden tokens:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && grep -rn "any\|TODO\|FIXME" src/lib/ranks.ts src/lib/user-rank.ts src/components/profile/RankCard.tsx src/components/profile/AchievementsCard.tsx | head -5
```

(Just informational — `any` may exist legitimately.)

**Step 3:** Manual smoke test (in browser, as `demo@ximi4ka.ru / DemoTest2026!`):
- `/profile` → see RankCard "Новичок 0%" + AchievementsCard
- SQL: `INSERT INTO task_attempts (user_id, task_id, answer, is_correct, points_earned, source) VALUES ('<demo-user-id>', NULL, '{}'::jsonb, true, 1100, 'tool_lab');` to bump XP to 1100
- Refresh `/profile` → now "Серебро 5%"
- `/pricing` → see banner + discounted prices
- Header → see Silver chip beside avatar
- Sign in as admin → click "Выйти" in sidebar → land on `/`
- Admin dashboard → see 5 KPIs + chart + lists

**Step 4:** Push:
```bash
cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && git push origin main
```

**Step 5:** Wait Vercel deploy (~90s), verify on https://learn.ximi4ka.ru.

---

## Plan complete

Plan saved to `docs/plans/2026-05-17-ranks-discounts-admin-polish-plan.md`. User chose **subagent-driven session** — proceeding directly to subagent dispatch.
