# XimOS — CLAUDE.md

## ⚠️ Two-repo structure — read FIRST

This workspace contains **two independent git repos**:

| Path | Remote | What |
|---|---|---|
| `/Users/vasilijaistov/Desktop/continuum/ximi4ka/` | `icekryptor/ximi4ka_finance` | Outer: backend, frontend, docs |
| `/Users/vasilijaistov/Desktop/continuum/ximi4ka/learn/` | `icekryptor/ximi-learn` | Inner: XimiLearn (deploys to Vercel `learn.ximi4ka.ru`) |

The outer `.gitignore` excludes `/learn/` so its files **must never** appear in outer commits.

**Rule for any git operation touching learn-zone files:**
- ALWAYS use `git -C /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn <command>` with absolute path
- OR explicitly `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && git ...` in the same Bash call
- NEVER rely on cwd persistence between Bash tool calls — it resets

**Rule for npm/build commands in learn:**
- `npm run build` / `npm run kits:generate` / etc must run inside `learn/` (outer has no package.json)
- Use `cd /Users/vasilijaistov/Desktop/continuum/ximi4ka/learn && npm run <script>` always

## Project Overview
**XimOS** — operational system for business management ("Операционная система управления бизнесом")
for Ximi4ka (a company manufacturing chemistry experiment kits). Started as financial-management
tool (then "XimFinance" / "XimERP"); evolved to span content production, marketplace analytics,
unit economics, planning, and team operations. Russian-language UI throughout.

## Tech Stack
- **Backend:** Node.js + Express + TypeORM + PostgreSQL (Supabase)
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Database:** Supabase (PostgreSQL), connection via `DATABASE_URL`
- **No state management library** — local React state + direct API calls via Axios

## Commands
- `cd backend && npm run dev` — start backend (port 3001)
- `cd frontend && npm run dev` — start frontend (port 5173)
- `cd backend && npm run seed` — seed categories & counterparties
- `cd backend && npm run seed:cost` — seed components & kits
- `cd backend && npm run build` — compile TypeScript
- `cd frontend && npm run build` — production build
- `cd frontend && npm run lint` — ESLint

## Project Structure
```
backend/
  src/
    config/database.ts    — TypeORM DataSource (Supabase-aware)
    entities/             — TypeORM entities
    routes/               — Express route handlers
    seeds/                — Seed scripts
    index.ts              — Entry point
frontend/
  src/
    api/                  — Axios client + API modules
    components/           — Reusable UI components
    pages/                — Page components
    App.tsx               — Router setup
    main.tsx              — Entry point
```

## Design System (from ximi4ka.ru)
- **Primary:** `#836efe` (purple/violet)
- **Gradient:** `rgba(141,103,255,1)` → `rgba(200,86,255,1)`
- **Dark accent:** `#6703ff`
- **Text dark:** `#1c1528`
- **Text secondary:** `#524667`
- **Border:** `#e8e5ef`
- **Background:** `#ffffff`, `#eeebf3`
- **Border radius:** large rounded (40-55px for cards/buttons)
- **Font:** Manrope (loaded via Google Fonts, weights 400/500/600/700/800, fallback IBM Plex Sans → Arial → system sans)
- **Style:** Clean minimalism with glassmorphic effects

## Conventions
- All UI text in Russian
- UUID primary keys on all entities
- RESTful API at `/api/*`
- Backend health check at `GET /health`
- TypeORM entities use decorators
- Frontend uses functional components with hooks

## Навигация по контексту:
1. ВСЕГДА запрашивайте граф знаний сначала
2. Читайте необработанные файлы, только если я явно так скажу