# Timeline — Project Structure

## Overview
Monorepo (npm workspaces). Two apps: `api` (backend) and `web` (frontend). Shared types in `packages/shared`.

## Directory structure
```
/
├── apps/
│   ├── api/          # Express 5 + Drizzle ORM + SQLite
│   │   ├── src/
│   │   │   ├── db/          # schema, migrate, seed
│   │   │   ├── routes/      # Express routers
│   │   │   ├── services/    # Business logic
│   │   │   └── integrations/ # Yandex Disk client
│   │   ├── drizzle/         # Migration files (generated)
│   │   └── drizzle.config.ts
│   └── web/          # React 19 + Vite + Tailwind + Radix UI
│       └── src/
│           ├── components/   # Reusable UI components
│           ├── features/     # Feature modules (events, timelines, etc.)
│           └── api/          # API client
├── packages/
│   └── shared/       # Shared types, Zod schemas, date utils
├── data/             # SQLite database files (git-ignored)
├── .env              # Local env vars (git-ignored)
├── .env.example      # Template for .env
├── package.json      # Root scripts (dev, build, db:*)
└── tsconfig.base.json
```

## Database
- **Engine:** SQLite (via `better-sqlite3` + Drizzle ORM)
- **Location:** `data/timeline.db` (relative to project root)
- **Config:** `DATABASE_URL` env var (`./data/timeline.db` by default)
- **Git:** `data/`, `*.db` are in `.gitignore` — not committed
- **Auto-create:** `data/` folder is created automatically by `migrate.ts`
- **Path resolution:** In `apps/api/` dev scripts, `DATABASE_URL=../../data/timeline.db` points to root `data/`

## Environment setup
```bash
cp .env.example .env
npm install
npm run build -w @timeline/shared
npm run db:generate -w @timeline/api
npm run db:migrate
npm run db:seed
npm run dev
```

## Key scripts (from root package.json)
| Script | Description |
|--------|-------------|
| `npm run dev` | Start both API (port 3001) and Web (port 5173) |
| `npm run build` | Build shared → api → web |
| `npm run db:generate` | Generate Drizzle migration from schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed database with test data |

## AI agent rules
1. **DB schema** (`apps/api/src/db/schema.ts`) — change with care, always run `npm run db:generate` after any column/table change
2. **Shared types** (`packages/shared/src/types.ts`) — update when adding new fields to DTOs
3. **Zod schemas** (`packages/shared/src/schemas.ts`) — keep in sync with DB schema
4. **API changes** require rebuilding shared: `npm run build -w @timeline/shared`
5. **Always run `npx tsc --noEmit -p apps/web/tsconfig.json`** after changes
6. **Never commit** `.env`, `data/`, `node_modules/`
7. **DB migrations** are generated into `apps/api/drizzle/` — these are committed to Git

## URL references
- Web UI: http://localhost:5173
- API: http://localhost:3001
- API docs: see route files in `apps/api/src/routes/`
