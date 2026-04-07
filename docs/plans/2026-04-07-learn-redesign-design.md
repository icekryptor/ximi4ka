# XimiLearn — Game-Vibe Design Overhaul

## Summary

Redesign XimiLearn from clean minimalism to a trendy, game-inspired aesthetic with pixel-art accents, glassmorphic effects, noise textures, neon color accents, and non-standard animations. CSS-first approach, single external dependency (canvas-confetti).

## Decisions

| Question | Answer |
|----------|--------|
| Pixel-art depth | Accent decorative elements only (icons, badges, hero bg). Core UI stays modern |
| Color scheme | Keep purple primary, add neon accents (cyan, magenta, lime, orange) |
| Animation level | Micro-animations + gamified animations (confetti, XP pop, streak fire, level up) |
| Noise/texture | Subtle noise overlay on entire bg + inside glass cards |
| Implementation | CSS-first (Tailwind + @keyframes), only canvas-confetti as dependency |

## 1. Typography

- **IBM Plex Sans** — primary font (headings, body, UI). Weights: 400, 500, 600, 700.
- **IBM Plex Mono** — chemical formulas, XP counters, streak numbers, numeric values.
- Loaded via `next/font/google` (self-hosted, zero layout shift).
- Cyrillic + Latin subsets.
- Tailwind: `font-sans` default on body, `font-mono` on numeric/formula elements.

## 2. Color Palette

### Brand (unchanged)
- `primary`: #836efe
- `primary-dark`: #6703ff
- Gradient: rgba(141,103,255,1) → rgba(200,86,255,1)

### Neon Accents (new)
| Token | Value | Semantic Use |
|-------|-------|-------------|
| `neon-cyan` | #00f0ff | XP, progress, levels |
| `neon-magenta` | #ff00e5 | Premium, special content |
| `neon-lime` | #a0ff00 | Streak, correct answers, growth |
| `neon-orange` | #ff6b00 | Streak warnings, urgency |

### Glow Variants (for box-shadow, text-shadow)
| Token | Value |
|-------|-------|
| `glow-cyan` | rgba(0,240,255,0.4) |
| `glow-magenta` | rgba(255,0,229,0.4) |
| `glow-lime` | rgba(160,255,0,0.4) |
| `glow-purple` | rgba(131,110,254,0.4) |

### Base (unchanged)
- `text-dark`: #1c1528
- `text-secondary`: #524667
- `border`: #e8e5ef
- `bg-light`: #eeebf3

## 3. Noise & Glass Textures

### Global Noise
- SVG feTurbulence as data-uri on `body::after`
- `position: fixed; inset: 0; pointer-events: none; z-index: 9999`
- `opacity: 0.04`, `background-size: 256px`, repeat
- ~200 bytes inline, zero dependencies

### Glass Cards
- `bg-white/40 backdrop-blur-xl border border-white/20`
- `shadow-[0_8px_32px_rgba(131,110,254,0.08)]`
- Inner noise via `::before` pseudo-element, opacity 0.06
- Hover: `shadow-[0_0_20px_glow-purple,0_8px_32px_rgba(131,110,254,0.1)]`

## 4. Animations

### CSS Keyframes (Tailwind config)
| Name | Effect | Duration | Usage |
|------|--------|----------|-------|
| `fade-in-up` | translateY(10px)→0, opacity 0→1 | 0.5s once | Cards on scroll |
| `shimmer` | bg-position sweep L→R | 2s infinite | Gradient text, skeletons |
| `pulse-glow` | box-shadow opacity 0.2→0.6→0.2 | 2s infinite | CTA, active streak |
| `float` | translateY(0→-6px→0) | 3s infinite | Pixel-art bg elements |
| `shake` | rotate(-2deg→2deg→0) | 0.3s once | Wrong answer |
| `count-up` | scale(1→1.2→1) + color flash | 0.4s once | XP counter increment |
| `xp-pop` | translateY(0→-30px), opacity 1→0 | 0.8s once | "+15 XP" popup |

### Gamified Animations
- **XP gain**: "+N XP" text floats up and fades (CSS xp-pop keyframe)
- **Streak fire**: CSS gradient layers animating at different speeds next to streak number
- **Level up**: Full-screen overlay flash (opacity 0→0.3→0, scale pulse), 0.6s
- **Confetti**: `canvas-confetti` (3KB gzipped) on achievement unlock
- **All animations**: `prefers-reduced-motion: reduce` disables them

### AnimateOnScroll Component
- Wrapper using IntersectionObserver
- Props: `animation`, `delay`, `threshold`
- Adds CSS class when element enters viewport

## 5. Pixel-Art Elements

### Icon Set (inline SVG, 16x16 pixel grid)
- Flask (колба) — modules/theory
- Atom — reactions
- Molecule — substances
- Fire — streak
- Star — XP/achievements
- Crystal — premium
- Potion — tasks
- Trophy — leaderboard
- Shield — badges

### PixelIcon Component
```tsx
<PixelIcon name="flask" size={32} className="text-neon-cyan" />
```
- SVG with `image-rendering: pixelated` for crisp pixel edges at any scale
- Colorable via `currentColor`

### Placement
- Hero background: 4-5 floating icons, opacity 0.15-0.3, `animate-float`
- Feature cards: replace emoji icons
- Achievement badges, XP counter, streak display
- Auth page backgrounds

## 6. Component Updates

### Button
- Primary: existing gradient + `hover:shadow-[0_0_20px_glow-purple]` + `hover:scale-[1.02]`
- Hero CTA: `animate-pulse-glow`
- Click: `active:scale-[0.98]`

### Card
- Default → glass: `bg-white/40 backdrop-blur-xl border-white/20` + inner noise + glow hover
- New `neon` variant: colored glow border (cyan/magenta/lime)
- `transition-all duration-300`

### Badge
- `streak`: lime glow + pixel-fire + font-mono
- `xp`: cyan glow + pixel-star + font-mono
- `premium`: magenta gradient + pixel-crystal
- All: subtle text-shadow from neon color

### ProgressBar
- Gradient fill cyan→purple
- Animated shimmer overlay
- Smooth value transitions + count-up pulse

### Input
- Focus: `ring-neon-cyan/30` + subtle glow

### New: XPPopup
- "+N XP" floats up and fades on correct answer

## 7. Page-Specific Changes

### Landing (Hero)
- Radial gradient bg (purple center → transparent)
- Floating pixel-art icons with `animate-float`
- "просто" text: `animate-shimmer`
- CTA: `animate-pulse-glow`
- Feature cards: pixel icons, glass, AnimateOnScroll staggered

### Dashboard
- Stat cards: neon variants (XP=cyan, streak=lime, accuracy=magenta)
- Numbers: font-mono, colored text-shadow
- Streak: pixel-fire icon, lime glow

### Leaderboard
- Top-3: enlarged cards with neon glow
- Current user row: purple glow highlight

### Lesson Viewer
- Content stays clean (IBM Plex Sans, readable typography)
- TaskBlock: shake on wrong, XPPopup + confetti on correct
- Lesson progress bar: shimmer animation

### Auth Pages
- Centered glass card on noise background
- Subtle floating pixel elements

### Header
- Pixel-flask icon next to "XimiLearn"
- Enhanced noise on blur background

## Dependencies

- `canvas-confetti` (~3KB gzipped) — achievement confetti only
- Everything else: Tailwind CSS + CSS @keyframes + inline SVG
