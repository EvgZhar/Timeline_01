# Timeline — Project Structure

## Overview
Monorepo (npm workspaces). Two apps: `api` (backend) and `web` (frontend). Shared types in `packages/shared`.

## Directory structure
```
/
├── apps/
│   ├── api/          # Express 5 + Drizzle ORM + PostgreSQL
│   │   ├── src/
│   │   │   ├── db/          # schema, migrate, seed, migrate-sqlite-to-pg
│   │   │   ├── routes/      # Express routers
│   │   │   │   ├── auth.ts      # /api/auth/* (login, register, verify-email, password reset)
│   │   │   │   ├── oauth.ts     # /api/auth/oauth/* (Yandex) + exchange-oauth-code
│   │   │   │   ├── admin.ts     # /api/admin/*
│   │   │   │   ├── events.ts    # /api/events/*
│   │   │   │   ├── timelines.ts # /api/timelines/*
│   │   │   │   ├── tags.ts      # /api/tags/*
│   │   │   │   ├── documents.ts # /api/documents/*
│   │   │   │   └── settings.ts  # /api/settings/*
│   │   │   └── services/
│   │   │       ├── auth/
│   │   │       │   ├── jwt.ts         # JWT sign/verify (HS256, 7-day expiry)
│   │   │       │   ├── password.ts    # scrypt hash/verify
│   │   │       │   ├── email.ts       # nodemailer + Яндекс SMTP
│   │   │       │   └── oauth/         # OAuth providers
│   │   │       │       ├── types.ts    # OAuthProvider interface
│   │   │       │       ├── yandex.ts   # Яндекс OAuth (активен)
│   │   │       │       ├── vk.ts       # VK OAuth (заготовка)
│   │   │       │       ├── google.ts   # Google OAuth (заготовка)
│   │   │       │       └── index.ts    # provider registry
│   │   │       ├── eventsService.ts
│   │   │       ├── timelinesService.ts
│   │   │       ├── tagsService.ts
│   │   │       ├── documentsService.ts
│   │   │       ├── permissionService.ts
│   │   │       └── settings/
│   │   │           ├── settingsService.ts
│   │   │           └── crypto.ts
│   │   │   └── middleware/
│   │   │       ├── authenticate.ts  # JWT Bearer middleware
│   │   │       └── errorHandler.ts
│   │   ├── drizzle/         # Migration files (generated)
│   │   └── drizzle.config.ts
│   └── web/          # React 19 + Vite + Tailwind + Radix UI
│       └── src/
│           ├── auth/          # Login, Register, VerifyEmail, ForgotPassword, ResetPassword, OAuthCallback pages
│           ├── admin/         # Admin panel
│           ├── components/    # Reusable UI components
│           ├── features/      # Feature modules (events, timelines, tags, settings)
│           └── api/           # API client
├── packages/
│   └── shared/       # Shared types, Zod schemas, date utils
├── data/
│   ├── db-info.md    # PostgreSQL credentials
│   ├── pgdata/       # PostgreSQL data files (Docker bind mount, git-ignored)
│   └── timeline.db   # Old SQLite DB (for rollback, git-ignored)
├── docker-compose.yml # PostgreSQL 17
├── .env              # Local env vars (git-ignored)
├── .env.example      # Template for .env
├── package.json      # Root scripts (dev, build, db:*)
└── tsconfig.base.json
```

## Database
- **Engine:** PostgreSQL 17 (via `pg` + Drizzle ORM)
- **Tables:** `SysDataAreaTable`, `SysUserTable` (includes email/reset token fields), `SysUserDataArea`, `SysUserSettingsTable`, `SysExternalLogin` (OAuth account links), `SysCounterTable`, `TimelineTable`, `EventTable`, `EventTimelineLink`, `TagTable`, `TagEventLink`, `DocumentTable`, `DocumentEventLink`, `UserPreferences`, `AppSettings`
- **Location:** Docker container, data in `data/pgdata/` (bind mount)
- **Config:** `DATABASE_URL` env var (`postgresql://timeline:password@localhost:5432/timeline` by default)
- **Git:** `data/` is in `.gitignore` — database files not committed
- **Start:** `docker compose up -d`

## Environment setup
```bash
cp .env.example .env
docker compose up -d
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

## Auth API routes (`/api/auth`)
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register` | POST | No | Register + create personal area + send verification email |
| `/login` | POST | No | Login by login+password |
| `/verify-email` | POST | No | Confirm email by token |
| `/resend-verification` | POST | No | Resend email verification |
| `/forgot-password` | POST | No | Send password reset email |
| `/reset-password` | POST | No | Reset password by token |
| `/me` | GET | Yes | Current user info |
| `/settings` | GET | Yes | Current data area + available areas |
| `/settings` | PUT | Yes | Update current data area |
| `/oauth/:provider` | GET | No | Redirect to OAuth provider |
| `/oauth/:provider/callback` | GET | No | OAuth callback → temp code → redirect to frontend |
| `/exchange-oauth-code` | POST | No | Exchange temp code for JWT |

## Admin API routes (`/api/admin`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/users` | GET | List all users (sorted by id ASC) |
| `/users/:id` | PUT | Update user (name, email, active, password) |
| `/users/:id/data-areas` | GET | User's data area IDs |
| `/next-user-code` | GET | Next `U######` code from counter |
| `/users/create` | POST | Create user (atomic counter inc + personal area + optional named) |
| `/data-areas` | GET | List all data areas |
| `/data-areas` | POST | Create data area |
| `/data-areas/:id` | PUT | Update data area |
| `/data-areas/:id` | DELETE | Delete data area (rejected if personal) |
| `/data-areas/:id/users` | GET | Users + rights for a data area |
| `/user-data-area` | POST | Set user rights on data area |
| `/user-data-area` | DELETE | Remove user from data area |

## Env variables
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (3001) |
| `JWT_SECRET` | 128 hex chars for JWT signing |
| `SETTINGS_ENCRYPTION_KEY` | 64 hex chars for settings encryption |
| `SMTP_HOST` | SMTP server (e.g. smtp.yandex.ru) |
| `SMTP_PORT` | SMTP port (465) |
| `SMTP_USER` | SMTP user (email) |
| `SMTP_PASS` | SMTP password (app password) |
| `YANDEX_CLIENT_ID` | Yandex OAuth app ID |
| `YANDEX_CLIENT_SECRET` | Yandex OAuth app secret |
| `VK_CLIENT_ID` | VK OAuth app ID (будет добавлено позже) |
| `VK_CLIENT_SECRET` | VK OAuth app secret (будет добавлено позже) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (будет добавлено позже) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (будет добавлено позже) |
| `AUTH_CALLBACK_URL` | Base URL for OAuth callbacks (e.g. http://localhost:3001) |
| `FRONTEND_URL` | Frontend URL for OAuth redirects (e.g. http://localhost:5173) |

## AI agent rules
1. **DB schema** (`apps/api/src/db/schema.ts`) — change with care, always run `npm run db:generate` after any column/table change
2. **Shared types** (`packages/shared/src/types.ts`) — update when adding new fields to DTOs
3. **Zod schemas** (`packages/shared/src/schemas.ts`) — keep in sync with DB schema
4. **API changes** require rebuilding shared: `npm run build -w @timeline/shared`
5. **Always run `npx tsc --noEmit -p apps/web/tsconfig.json`** after changes
6. **Never commit** `.env`, `data/`, `node_modules/`
7. **DB migrations** are generated into `apps/api/drizzle/` — these are committed to Git
8. **PostgreSQL** runs via Docker: `docker compose up -d` before `npm run db:migrate`
9. **Delete result** in pg returns `rowCount` (not `changes` as in SQLite)
10. **Yandex Disk removed** — `createFromUpload` stores metadata without cloud upload; preview falls back to `originalLink`

## URL references
- Web UI: http://localhost:5173
- API: http://localhost:3001
- API docs: see route files in `apps/api/src/routes/`
