---
name: deploy
description: |
  Use when the user says "деплой", "deploy", "прод", "production", "задеплой",
  or asks to push changes to the production server.
  The skill connects to the production server via SSH, pulls latest changes,
  builds the project, applies migrations, and restarts services.
  NOT for local builds, NOT for development, NOT for testing.
---

# Deploy to Production

Server: `pretty-timeline.ru`
User: `root`
SSH key: `~/.ssh/id_ed25519` (уже добавлен в GitHub и на сервере)
Path: `/opt/timeline`
PM2 process: `timeline-api`

## Шаги деплоя

1. Подключиться: `ssh root@pretty-timeline.ru`
2. Перейти: `cd /opt/timeline`
3. **Pull:** `git pull`
4. **Build shared:** `npm run build -w @timeline/shared`
5. **Generate migrations (если менялась схема):** `npm run db:generate -w @timeline/api`
6. **Apply migrations:** `npm run db:migrate`
7. **Build всё:** `npm run build` (shared → api → web)
8. **Restart API:** `pm2 restart timeline-api`

## Ограничения

- Не очищать БД, не запускать seed на проде
- Не перезагружать сервер целиком
- Не менять конфиги вручную — только через коммит и деплой
