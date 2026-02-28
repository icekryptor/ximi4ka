# XimFinance — CLAUDE.md

## Project Overview
Financial management system for Ximi4ka — a company manufacturing chemistry experiment kits.
Russian-language UI throughout.

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
- **Font:** Arial
- **Style:** Clean minimalism with glassmorphic effects

## Conventions
- All UI text in Russian
- UUID primary keys on all entities
- RESTful API at `/api/*`
- Backend health check at `GET /health`
- TypeORM entities use decorators
- Frontend uses functional components with hooks
