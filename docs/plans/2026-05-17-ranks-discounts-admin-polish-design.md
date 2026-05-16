# Ranks, Discounts & Admin Polish — design doc

Date: 2026-05-17
Status: approved (delegated)
Scope: XimiLearn (`learn/`)

## Goal

Three parallel improvements:
1. **Gamification — ranks system** with XP thresholds and matching subscription discounts
2. **Achievements** prominently displayed in profile alongside rank
3. **Admin polish** — logout button, richer dashboard, consistent padding

Kits/Tilda checkout is NOT affected — discounts only apply to subscription renewals through our own `/pricing` page.

## Ranks system

### Thresholds (computed from `total_xp`)

| Rank | XP needed | Color | Icon (lucide) | Discount |
|---|---|---|---|---|
| Новичок | 0 | gray-400 | Sparkle | 0% |
| Бронза | 500 | amber-600 (#b45309) | Award | 3% |
| Серебро | 1000 | slate-400 (#94a3b8) | Medal | 5% |
| Золото | 2000 | yellow-500 (#eab308) | Trophy | 8% |
| Платина | 4000 | cyan-400 (#22d3ee) | Crown | 10% |
| Алмаз | 6000+ | violet-400 (#a78bfa) | Diamond | 12% |

Note: spec said discounts 0/3/5/8/12 for the five paid ranks. I added "Новичок" as the 0-XP starting state and bumped Platinum to 10% to keep a smooth curve — adjust later if needed. Diamond keeps 12%.

### Computed live, no schema change

`getUserRank(totalXp): { rank, nextRank, xpToNext, progressPct, discountPercent }`

XP comes from existing `task_attempts.points_earned` sum (same source as `getUserStats`). No new DB column — pure derivation.

## Profile page changes

Above existing cards, add **two-column block**:

**Left (rank card):**
- Big colored circle/icon with rank icon (e.g. Trophy for Gold)
- Rank name (font-display, large)
- "Твоя скидка: 8%" pill
- Progress bar: current XP → next threshold
- Caption: "До ранга Платина: 1340 XP"

**Right (achievements card):**
- Header "Достижения: 5/24"
- Grid of 6 latest achievement icons (locked = grayscale)
- "Смотреть все →" link to `/achievements`

## Header badge (both light and dark zones)

Tiny rank chip immediately left of the avatar/profile-preview:
- Icon + rank name (compact)
- Tooltip on hover: "Серебро · 5% скидка · до Золота 750 XP"
- Hidden on mobile to save space (kept only avatar)

## Pricing page integration

When user is logged in and has rank > Новичок:

- Banner above plan cards: "С твоим рангом **Серебро** действует скидка **5%** на все подписки"
- Each plan shows:
  - Crossed-out original price (small)
  - Discounted final price (large, purple)
  - "−5%" badge

When unauthenticated → existing behaviour (no discount, no banner).

## Payment flow integration

API `/api/payments/create` (and `/api/payments/create-module`) — modify to:
1. Look up user's rank from their `total_xp`
2. Apply discount: `finalAmount = baseAmount * (1 - discount/100)`
3. Send `finalAmount` to YandexPay
4. Store both `base_amount` and `final_amount` + `rank_at_purchase` + `discount_pct_at_purchase` in `subscriptions` row for audit

Migration `010_subscription_discount.sql`:
```sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_pct INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_at_purchase TEXT;
```

## Admin polish

### Logout

- Add icon button at bottom of admin sidebar (below nav links): "Выйти" with `LogOut` icon
- Wires to existing Supabase signOut + redirect to `/`

### Dashboard widgets

Replace 4-counter row with richer dashboard:

**Row 1: KPI tiles (5)**
- Учеников (всего)
- Активных подписок
- Активных kit-доступов (через user_modules where expires_at > now)
- Партий наборов (sum batches, sum credentials)
- Дашборд-карточка "Активаций сегодня" / "за неделю"

**Row 2: Two-column**
- **Свежие регистрации** (последние 10 юзеров за 7 дней): аватар, имя, дата, источник (kit/email)
- **Свежие активации kit-кодов** (последние 10): логин, имя, дата

**Row 3:**
- **График активаций по дням** (последние 30 дней) — простой sparkline через CSS bars, без библиотек

### Padding pass

Audit all admin pages, normalize:
- Outer container: `p-6` consistently
- Page header: h1 mb-6
- Card grids: gap-4
- Tables: standardized cell padding

## Database changes

New migration `010_subscription_discount.sql` (above).
No changes for ranks (computed) or achievements (table exists).

## Files affected (summary)

| File | Change |
|---|---|
| `src/lib/ranks.ts` (NEW) | Pure functions: `getRank(xp)`, `getNextRank(xp)`, `RANKS` config |
| `src/components/profile/RankCard.tsx` (NEW) | Rank + progress UI |
| `src/components/profile/AchievementsCard.tsx` (NEW) | Achievement grid in profile |
| `src/components/layout/ProfilePreview.tsx` | Add rank chip beside avatar |
| `src/app/(learn)/profile/page.tsx` | Render new RankCard + AchievementsCard above existing cards |
| `src/app/(public)/pricing/page.tsx` | Show discount banner + crossed-out prices |
| `src/app/api/payments/create*/route.ts` | Apply rank discount to final amount |
| `src/app/(admin)/layout.tsx` | Add logout button at sidebar bottom |
| `src/app/(admin)/admin/page.tsx` | New dashboard widgets |
| `src/app/(admin)/admin/*/page.tsx` | Padding normalization sweep |
| `supabase/migrations/010_subscription_discount.sql` | New cols for audit |

## Out of scope

- Monthly leaderboard prizes — user said "пока думаю, какие" → defer
- Rank-up notifications / celebrations — defer to future polish
- Rank decay (XP doesn't decay) — staying with cumulative model
- Adjusting discount on Tilda kit purchases — explicitly excluded per user
- Webhook-driven discount sync to external systems

## Acceptance

- [ ] Demo user (currently 0 XP) sees "Новичок" rank with 0% discount in profile
- [ ] Manually granting 1000 XP makes them "Серебро" with 5% discount visible
- [ ] `/pricing` shows discounted prices for logged-in non-Новичок user
- [ ] Logout works from admin sidebar
- [ ] Admin dashboard shows 5 KPI tiles + recent signups + recent activations
- [ ] No visual padding regressions in admin
