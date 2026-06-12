# AGENTS.md — Timeline

Памятка для OpenCode-сессий.

## Быстрый старт

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

Seed: `admin`/`admin` (админ), `testuser`/`test1234` (обычный).

## Команды разработки

| Команда | Назначение |
|---------|------------|
| `npm run dev` | concurrently API :3001 + Web :5173 |
| `npm run build` | shared → api → web |
| `npm run build -w @timeline/shared` | **обязательно** после изменений типов/схем |
| `npm run build -w @timeline/web` | = `tsc --noEmit && vite build` |
| `npm run db:generate -w @timeline/api` | Drizzle: генерация миграции |
| `npm run db:migrate` | применить миграции |
| `npm run db:seed` | сид (вызывает `seed.ts`) |
| `npm run db:cleanup-tokens -w @timeline/api` | очистка истёкших refresh-токенов |
| `npm run rate-limit:reset -w @timeline/api` | сброс in-memory rate limiters |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | typecheck web |
| `npm run dev -w @timeline/shared` | `tsc --watch` для shared |

## Архитектура

```
apps/api/       Express 5 + Drizzle ORM + PostgreSQL 17
apps/web/       React 19 + Vite 6 + Tailwind CSS v4 + Radix UI + TanStack Query
packages/shared/ Zod-схемы, TypeScript-типы, утилиты дат
```

**Порядок сборки:** shared → api → web. После изменений shared — пересобрать его, иначе api/web увидят старый `dist/`.

## Особенности

### API
- ES modules (`"type": "module"`), tsconfig `module: "NodeNext"`
- `tsx` для dev/скриптов, скрипты грузят `.env` явно (`--env-file=../../.env`)
- JWT-секрет: если не задан `JWT_SECRET`, создаётся при старте в `data/.jwt_secret`
- DELETE в PostgreSQL возвращает `rowCount`, не `changes` (как было в SQLite)

### Web
- Tailwind v4 через `@tailwindcss/vite` (не PostCSS, нет `tailwind.config`)
- `@/` → `./src/*`, Vite проксирует `/api` → `http://localhost:3001`
- `noUnusedLocals: true`, `noUnusedParameters: true` в tsconfig
- React Query `staleTime: 30_000` мс

### Shared
- Единый источник истины для типов и схем API + Web
- Даты: UI — `ДД.ММ.ГГГГ`, хранение — ISO `YYYY-MM-DD`.
  Конвертация только через `dates.ts` (`formatDisplay`, `parseDisplay`, `toStorage`).
  Не парсить/форматировать даты ad-hoc.

## Многопользовательский режим (DataArea)

Все записи привязаны к DataArea. Каждый CRUD-endpoint проверяет права через `permissionService.ts`:

- `getAllowedDataAreaIds(userId, action?)` — фильтр при чтении
- `checkPermission(userId, dataAreaId, action)` — проверка перед мутацией
- `getCurrentDataAreaId(userId)` — текущая область пользователя

Флаги: `canRead` / `canCreate` / `canUpdate` / `canDelete`.

## Аутентификация

- JWT HS256, 7 дней, в `localStorage`
- Пароли: scrypt (не bcrypt)
- OAuth: Яндекс (активен), VK/Google — заготовки
- SMTP: nodemailer + Яндекс.Почта

## База и миграции

- PostgreSQL 17 в Docker
- Схема: `apps/api/src/db/schema.ts` — после изменений всегда `npm run db:generate`
- Миграции (`apps/api/drizzle/`) коммитятся в Git
- Два seed-скрипта: `seed.ts` (быстрый), `seed-full.ts` (~60 исторических событий)

## Остаточные артефакты

- Файл `.cursor/plans/timeline_mvp_build_941c1233.plan.md` — исторический план, может не совпадать с текущим кодом

## Тестирование

Сценарии ручного интеграционного тестирования: `test-scenarios/README.md`.

Перед прогоном убедиться, что API запущен (`npm run dev` или `pm2 start`), сидовые данные загружены (`npm run db:seed`). Артефакты тестов (экспорт `.xlsx`) сохраняются в `localtemp/`.

## Локальные выгрузки

Все файлы, создаваемые в рамках проекта агентом, сохраняются в корневую папку `localtemp/`:

- **Excel-выгрузки** (экспорт событий/данных в `.xlsx`) → `localtemp/`
- **Документы в формате `.md`**, сгенерированные агентом (отчёты, списки, описания) → `localtemp/`

Папка `localtemp/` добавлена в `.gitignore`.
