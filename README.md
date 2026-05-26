# История в таймлайне

Веб-приложение для регистрации исторических событий и отображения их на интерактивном таймлайне. Поддерживает multi-user режим с разграничением доступа по областям данных (DataArea).

## Стек

- **Монорепозиторий:** npm workspaces
- **Shared:** `packages/shared` — TypeScript-типы и схемы валидации (Zod)
- **API:** `apps/api` — Express 5, Drizzle ORM, PostgreSQL (pg)
- **Web:** `apps/web` — React, Vite, TypeScript, Tailwind CSS, TanStack Query, react-router-dom
- **Аутентификация:** JWT (HMAC-SHA256) + scrypt (Node.js crypto)
- **СУБД:** PostgreSQL 17 (Docker)

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d                    # Запустить PostgreSQL
npm install
npm run build -w @timeline/shared
npm run db:generate -w @timeline/api    # Сгенерировать миграции из схемы
npm run db:migrate                      # Применить миграции
npm run db:seed                         # Seed: Default DataArea + admin + testuser
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

**Seed-пользователи** (создаются командой `npm run db:seed`):

| Логин | Пароль | Роль |
|-------|--------|------|
| `admin` | `admin` | Администратор, полный доступ ко всем DataArea |
| `testuser` | `test1234` | Обычный пользователь, личная DataArea + чтение Default |

## Миграция с SQLite на PostgreSQL

Если у вас есть существующие данные в `data/timeline.db`:

1. Запустите PostgreSQL: `docker compose up -d`
2. Примените миграции: `npm run db:migrate`
3. Запустите перенос данных: `npx tsx apps/api/src/db/migrate-sqlite-to-pg.ts`

SQLite-файл остаётся нетронутым — в случае проблем верните `DATABASE_URL` в `.env` на `./data/timeline.db`.

## Структура проекта

```
apps/
  api/        — Express-сервер
  web/        — React-фронтенд
packages/
  shared/     — Общие типы и схемы
data/
  db-info.md  — Учётные данные PostgreSQL
  pgdata/     — Файлы БД PostgreSQL (Docker bind mount)
  timeline.db — Старая SQLite БД (для отката)
```

## Data Areas (области данных)

Все записи (события, шкалы, теги, документы) привязаны к DataArea. Пользователь видит и редактирует только те области, к которым у него есть права.

**Встроенные области:**

| Id | Название | Назначение |
|----|----------|------------|
| 1 | Default | Общая область для всех пользователей (read-only для обычных) |
| 2 | admin-personal | Личная область администратора |
| 3+ | user-*-personal | Личная область каждого зарегистрированного пользователя |

### Права доступа

Для каждой пары пользователь-DataArea задаются флаги:

| Флаг | Действие |
|------|----------|
| `canRead` | Просмотр записей в области |
| `canCreate` | Создание новых записей |
| `canUpdate` | Редактирование существующих записей |
| `canDelete` | Удаление записей и связей |

**Логика работы:**
- Выпадающий список областей в TopBar показывает только области с `canCreate` — пользователь выбирает, куда сохранять изменения
- При редактировании события можно добавить ссылку на таймлайн из другой области (если есть права на чтение события и создание в области таймлайна)
- Удаление связи между событием и таймлайном требует `canDelete` на DataArea этой связи

## Аутентификация

- `/login` — вход (JWT-токен в localStorage)
- `/register` — регистрация (автоматически создаётся личная DataArea)
- JWT-секрет автоматически сохраняется в `data/.jwt_secret` при первом запуске и переживает перезапуски сервера

## Административная панель

`/admin` (доступна пользователю с логином `admin`):

- **Пользователи:**
  - Поиск по полю (фамилия/имя/email/логин)
  - Создание: автонумерация кода (`sysCounterTable`, формат `U######`), код и название области данных — read-only с сервера, подтверждение пароля
  - Inline-редактирование (имя, email) + чекбоксы доступа к DataArea
  - Сортировка по id (возрастание)
  - Кнопки: Save слева, Cancel справа
- **DataArea:**
  - Поиск по имени/описанию
  - Inline-редактирование (rename)
  - Удаление с подтверждением (защита от удаления personal area)
  - Кнопки: Save слева, Cancel/Delete справа
- **Права:** управление (canRead/canCreate/canUpdate/canDelete) для каждой пары пользователь-область

## Миграции

```bash
npm run db:generate -w @timeline/api   # Сгенерировать миграцию из схемы
npm run db:migrate                      # Применить миграции
npm run db:seed                         # Seed: Default DataArea + admin + testuser
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Строка подключения к PostgreSQL (по умолч. `postgresql://timeline:password@localhost:5432/timeline`) |
| `PORT` | Порт API (3001) |
| `JWT_SECRET` | Ключ для подписи JWT (авто-генерация + сохранение в `data/.jwt_secret`) |
| `SETTINGS_ENCRYPTION_KEY` | 64 hex-символа для шифрования секретов в БД |
