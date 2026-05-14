# XimiLearn — ximi4ka-aligned redesign (design doc)

Date: 2026-05-14
Status: approved
Pivot from: `2026-04-07-learn-redesign` (game-vibe dark theme with neon and pixel-art)
Pivot to: hybrid two-zone system aligned with ximi4ka.ru lab-tech brand

## Goal

Re-align XimiLearn visuals with the ximi4ka.ru parent brand while preserving the gamification mechanics built in the previous redesign. The platform should feel like *the ximi4ka product line* — not a separate visual universe.

## Two-zone architecture

| Zone | Routes | Theme |
|---|---|---|
| Marketing | `/`, `/pricing`, `/modules`, `/modules/[slug]` | Light, ximi4ka.ru style |
| Auth | `/login`, `/register`, `/forgot-password` | Light, matches marketing |
| Learn | `/dashboard`, `/learn/*`, `/leaderboard`, `/profile`, `/achievements` | Dark with purple tint |
| Admin | `/admin/*` | Untouched (already light/functional) |

Logic: marketing = "the ximi4ka site", learn = "the chemistry app".

## Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | **Unbounded** | 400, 600, 700 | Hero H1, dramatic moments |
| Body / UI | **Manrope** | 300, 400, 500, 600, 700, 800 | Everything else |
| Mono | **JetBrains Mono** | 400, 500, 700 | Numbers in learn-zone (XP, counters, progress %) — `tabular-nums` |

Loaded via `next/font/google` with CSS variables. IBM Plex removed. JetBrains Mono only loaded on learn routes.

### Scale
| Token | Size | Family |
|---|---|---|
| `display-xl` | 64px | Unbounded 700 |
| `display-l` | 48px | Unbounded 600 |
| `h1` | 36px | Manrope 700 |
| `h2` | 28px | Manrope 700 |
| `h3` | 22px | Manrope 600 |
| `h4` | 18px | Manrope 600 |
| `body` | 16px | Manrope 400 |
| `small` | 14px | Manrope 500 |
| `caption` | 12px | Manrope 600 (uppercase, tracking-wide) |

Line-height: 1.5 for body, 1.15 for display, 1.3 for headings.

## Color tokens

### Light (marketing + auth)
```
bg-base:       #ffffff
bg-secondary:  #eeebf3
bg-tertiary:   #f6f4fa
text-primary:  #1c1528
text-secondary:#524667
text-muted:    #8479a3
border:        #e8e5ef
border-subtle: #f0edf5
primary:       #836efe
primary-hover: #6c54fc
primary-dark:  #6703ff
gradient-from: rgba(141,103,255,1)
gradient-to:   rgba(200,86,255,1)
success:       #5dc973
error:         #f56565
```

### Dark (learn)
```
bg-base:        #0f0915  (deep purple-black, NOT neutral)
bg-elevated:    #1a1228
surface:        #221833
surface-hover:  #2a1f3d
text-primary:   #f0eaff  (purple-tinted white)
text-secondary: #a89fc4
text-muted:     #6f6489
border:         rgba(255,255,255,0.08)
border-strong:  rgba(255,255,255,0.12)
primary:        #836efe  (same)
primary-glow:   rgba(131,110,254,0.35)
success:        #6ee7a0
error:          #fc8181
```

**Neon removed entirely.** All accents in learn-zone are purple variations. Monochromatic by design.

## Border radius

| Element | Radius |
|---|---|
| Hero card | 40px |
| Containers / sections | 32px |
| Buttons | full pill (9999px) |
| Inner content blocks | 20px |
| Inputs | 16px |
| Task blocks | 20px |
| Badges | full pill |
| Icon containers | 20px |

## Components

### Card
- **Default light:** `bg-white` + `border-#e8e5ef` + `radius-32px` + soft shadow
- **Default dark:** `bg-surface` + `border-rgba(255,255,255,0.08)` + `radius-32px`
- **`glass={true}` light:** `bg-white/60` + `backdrop-blur-xl` + `border-white/40` + tinted shadow
- **`glass={true}` dark:** `bg-white/[0.05]` + `backdrop-blur-xl` + `border-white/[0.1]`
- **Hover:** `translateY(-2px)` + shadow lift (no `scale`, avoids layout shift)
- Glass used only on: hero card, CTA cards, premium pricing card, achievement modals

### Button
- **Primary:** gradient bg, pill, white text, `py-3.5 px-8`, glow shadow on hover
- **Secondary light:** `bg-white border-border text-text-primary`
- **Secondary dark:** `bg-white/10 text-text-primary border-white/10`
- **Ghost:** transparent, text-secondary, hover bg-secondary
- All have `cursor-pointer`, focus ring (`primary/30`), `active:opacity-90`

### Input
- 16px radius, border focus → primary
- Light: `bg-white border-border`
- Dark: `bg-white/[0.05] border-white/10`

### Badge
- Pill, no neon
- **Streak:** `bg-primary/10 text-primary` + Lucide `Flame` icon
- **XP:** `bg-primary/10 text-primary` + Lucide `Star` icon, JetBrains Mono numbers (learn only)
- **Premium:** gradient bg + Lucide `Sparkles` icon

### ProgressBar
- Pill rounded, fill gradient (`#836efe → #c856ff`), subtle purple shimmer overlay

### Header
- Light marketing: `bg-white/80 backdrop-blur-md border-b border-border`
- Dark learn: `bg-bg-base/80 backdrop-blur-md border-b border-white/[0.06]`

## Animations (all preserved, recolored)

- `fade-in-up` — entry animation
- `shimmer` — text shimmer for hero "просто" word (purple gradient)
- `pulse-glow` — CTA primary button (purple glow)
- `float` — only used on subtle hero gradient blobs (no decorative icons)
- `shake` — wrong answer feedback
- `count-up` — XP/score counters
- `xp-pop` — floating "+N XP" (purple, JetBrains Mono)
- `streak-fire` — flame icon flicker

**Confetti** (canvas-confetti) recolored to purple palette: `#836efe`, `#c856ff`, `#ad7afe`, `#9d8aff`.

`prefers-reduced-motion` respected — all decorative animations disabled.

## Decorative elements

- **Removed:** floating pixel-art icons, SVG noise overlay (it was too subtle to matter)
- **Kept:** single subtle radial gradient on hero
  - Light marketing: `radial-gradient(circle, rgba(131,110,254,0.06) 0%, transparent 60%)`
  - Dark learn: `radial-gradient(circle, rgba(131,110,254,0.18) 0%, transparent 60%)`
- Pure minimalism otherwise. No floating molecules, no blob shapes, no chemistry illustrations.

## Icons

- **Library:** [Lucide React](https://lucide.dev/) (modern, extensive, free, tree-shakeable)
- All emojis removed from UI
- Default size 24x24, stroke 1.5
- `<PixelIcon>` component **deleted**
- All 9 previous pixel icons mapped to Lucide:
  - flask → `FlaskConical`
  - atom → `Atom`
  - molecule → `Hexagon`
  - fire → `Flame`
  - star → `Star`
  - crystal → `Diamond`
  - potion → `TestTube`
  - trophy → `Trophy`
  - shield → `Shield`

## Interaction polish

- All clickable elements: `cursor-pointer`
- Hover transitions: `transition-colors duration-200` (color/opacity only — no scale that causes layout shift)
- Active state: `active:opacity-90` (not scale)
- Focus rings: visible 2px ring `ring-primary/30` on inputs and buttons
- Min touch target: 44x44px

## Glassmorphism (moderate)

Used selectively on:
1. Hero card (marketing landing)
2. CTA cards (Get Started prompts)
3. Premium pricing card
4. Achievement unlock toast/modal

All other cards are solid surfaces with subtle borders. Reduces visual noise; improves readability.

## What gets deleted

| File / element | Why |
|---|---|
| `PixelIcon.tsx` | Replaced by Lucide |
| All neon color tokens (`neon-cyan`, `neon-magenta`, `neon-lime`, `neon-orange`) | Removed per spec |
| All neon glow shadows | Replaced by single `glow-purple` |
| IBM Plex Sans/Mono font loaders | Replaced by Manrope + Unbounded + JetBrains Mono |
| Floating pixel-art icon usage | Per "pure minimalism" decoration spec |
| SVG noise overlay (`body::after`) | Simplification |

## What gets kept (works as-is)

- Gamification mechanics: XP, streaks, achievements, leaderboard ranking, confetti on correct answers, XPPopup component
- Two-column layouts for dashboard/lessons
- Component composition patterns (Card, Button, Badge, ProgressBar, Input)
- Route group structure: `(public)`, `(auth)`, `(learn)`, `(admin)`
- AnimateOnScroll component (just changes color tokens it uses)

## Per-page changes summary

| Page | Theme | Key changes |
|---|---|---|
| `/` (landing) | Light | Hero with subtle purple gradient, glass card on offer block, Lucide icons in features, pill CTAs |
| `/pricing` | Light | Solid cards, glass on premium tier, pill buttons |
| `/modules` | Light | Solid module cards, Lucide icons, pill chips |
| `/modules/[slug]` | Light | Same |
| `/login`, `/register`, `/forgot-password` | Light | Clean centered card, no decorative floats |
| `/dashboard` | Dark | Purple-glow stat cards, Lucide icons, mono numbers, glass on hero "Continue" card |
| `/learn/[slug]/[lesson]` | Dark | Content panel stays high-contrast (current `bg-white/95` pattern OK), nav dark |
| `/leaderboard` | Dark | Top-3 cards with purple glow only (no rainbow), pill avatars |
| `/profile`, `/achievements` | Dark | Same pattern |
| `/admin/*` | — | **Untouched** |

## Build / package changes

- Add: `@fontsource` not needed — using `next/font/google`
- Add: `lucide-react`
- Remove: nothing yet (canvas-confetti stays)
- Update: `tailwind.config.ts` with new tokens
- Update: `globals.css` with new fonts and base styles
- Delete: `PixelIcon.tsx`

## Verification criteria

- All pages render in correct theme (marketing light, learn dark)
- No neon colors anywhere in compiled CSS (`grep -r "neon-" learn/src` returns 0)
- No pixel-art usage (`grep -r "PixelIcon" learn/src` returns 0)
- Manrope + Unbounded + JetBrains Mono load successfully
- All Lucide icons render
- Confetti uses purple palette
- `next build` passes
- Visual smoke test: 6 key pages screenshot-checked at 1280px and 375px widths

## Out of scope

- Admin redesign
- Backend changes
- Content/copy changes
- Mobile app considerations
- Dark mode toggle (zones determine theme, not user pref)
