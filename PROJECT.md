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

## Agent instructions

См. [`AGENTS.md`](./AGENTS.md) — памятка для OpenCode-сессий (команды, архитектура, особенности).

## URL references
- Web UI: http://localhost:5173
- API: http://localhost:3001
- API docs: see route files in `apps/api/src/routes/`
