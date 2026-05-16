# История в таймлайне

Веб-приложение для регистрации исторических событий и отображения их на интерактивном таймлайне.

## Стек

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend:** Express 5, Drizzle ORM, SQLite
- **Файлы:** Yandex Disk API

## Быстрый старт

```bash
cp .env.example .env
npm install
npm run build -w @timeline/shared
npm run db:generate -w @timeline/api
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

## Настройка Яндекс.Диска

1. Создайте приложение на https://oauth.yandex.com/
2. Получите OAuth-токен с правами `cloud_api:disk.read` и `cloud_api:disk.write`
3. В приложении откройте **Настройки** и сохраните токен и папку (по умолчанию `app:/timeline/`)

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Путь к SQLite (по умолчанию `./data/timeline.db`) |
| `PORT` | Порт API (3001) |
| `SETTINGS_ENCRYPTION_KEY` | 64 hex-символа для шифрования секретов в БД |
