# История в таймлайне

Веб-приложение для регистрации исторических событий и отображения их на интерактивном таймлайне. Поддерживает multi-user режим с разграничением доступа по областям данных (DataArea).

## Стек

- **Монорепозиторий:** npm workspaces
- **Shared:** `packages/shared` — TypeScript-типы и схемы валидации (Zod)
- **API:** `apps/api` — Express 5, Drizzle ORM, PostgreSQL (pg)
- **Web:** `apps/web` — React, Vite, TypeScript, Tailwind CSS, TanStack Query, react-router-dom
- **Аутентификация:** JWT (HS256, 7 дней) + scrypt (Node.js crypto) + OAuth (Яндекс)
- **Email:** nodemailer + SMTP (Яндекс.Почта)
- **СУБД:** PostgreSQL 17 (Docker)

## Быстрый старт

```bash
cp .env.example .env
# Отредактировать .env: вписать SMTP, JWT_SECRET, OAuth-ключи (см. раздел Настройка)
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
| --- | --- | --- |
| `admin` | `admin` | Администратор, полный доступ ко всем DataArea |
| `testuser` | `test1234` | Обычный пользователь, личная DataArea + чтение Default |

## Настройка

### SMTP (подтверждение email / восстановление пароля)

Для Яндекс.Почты:
| Переменная | Значение |
| --- | --- |
| `SMTP_HOST` | `smtp.yandex.ru` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | ваш email на Яндексе |
| `SMTP_PASS` | пароль приложения (настройки Яндекса → Безопасность → Пароли приложений) |

### OAuth

**Яндекс:**
1. Создать приложение на https://oauth.yandex.ru/ (тип «Веб-сервис»)
2. Callback URL: `http://localhost:3001/api/auth/oauth/yandex/callback`
3. Права: `login:email`, `login:info`
4. Вписать `YANDEX_CLIENT_ID` (ID приложения) и `YANDEX_CLIENT_SECRET` (Пароль)

*VK и Google — будут добавлены позже.*

## Аутентификация

| Страница | Маршрут | Описание |
| --- | --- | --- |
| Вход | `/login` | По паролю или через Яндекс |
| Регистрация | `/register` | Создание аккаунта + письмо для подтверждения email |
| Подтверждение email | `/verify-email?token=` | Автоматический переход из письма |
| Восстановление пароля | `/forgot-password` | Запрос ссылки для сброса |
| Сброс пароля | `/reset-password?token=` | Установка нового пароля |
| OAuth callback | `/auth/callback?code=` | Промежуточная страница для обмена OAuth-кода |

- JWT хранится в `localStorage`, срок действия — 7 дней
- При регистрации автоматически создаётся личная DataArea
- OAuth-аккаунты привязываются к существующему пользователю по email или создают нового

## Data Areas (области данных)

Все записи (события, шкалы, теги, документы) привязаны к DataArea. Пользователь видит и редактирует только те области, к которым у него есть права.

**Встроенные области:**

| Id | Название | Назначение |
| --- | --- | --- |
| 1 | Default | Общая область для всех пользователей (read-only для обычных) |
| 2 | admin-personal | Личная область администратора |
| 3+ | user-*-personal | Личная область каждого зарегистрированного пользователя |

### Права доступа

Для каждой пары пользователь-DataArea задаются флаги:

| Флаг | Действие |
| --- | --- |
| `canRead` | Просмотр записей в области |
| `canCreate` | Создание новых записей |
| `canUpdate` | Редактирование существующих записей |
| `canDelete` | Удаление записей и связей |

**Логика работы:**
- Выпадающий список областей в TopBar показывает только области с `canCreate` — пользователь выбирает, куда сохранять изменения
- При редактировании события можно добавить ссылку на таймлайн из другой области (если есть права на чтение события и создание в области таймлайна)
- Удаление связи между событием и таймлайном требует `canDelete` на DataArea этой связи

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
| --- | --- |
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `PORT` | Порт API (3001) |
| `JWT_SECRET` | 128 hex-символов для подписи JWT |
| `SETTINGS_ENCRYPTION_KEY` | 64 hex-символа для шифрования секретов в БД |
| `SMTP_HOST` | SMTP-сервер (smtp.yandex.ru) |
| `SMTP_PORT` | Порт SMTP (465) |
| `SMTP_USER` | Email для SMTP |
| `SMTP_PASS` | Пароль приложения для SMTP |
| `YANDEX_CLIENT_ID` | ID приложения Яндекс OAuth |
| `YANDEX_CLIENT_SECRET` | Секрет приложения Яндекс OAuth |
| `VK_CLIENT_ID` | ID приложения VK OAuth (будет добавлено позже) |
| `VK_CLIENT_SECRET` | Секрет приложения VK OAuth (будет добавлено позже) |
| `GOOGLE_CLIENT_ID` | ID приложения Google OAuth (будет добавлено позже) |
| `GOOGLE_CLIENT_SECRET` | Секрет приложения Google OAuth (будет добавлено позже) |
| `AUTH_CALLBACK_URL` | Базовый URL для OAuth-колбэков |
| `FRONTEND_URL` | URL фронтенда для редиректов после OAuth |
