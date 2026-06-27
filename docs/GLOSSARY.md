# Глоссарий проекта Timeline

## Правила ведения

1. **Новый термин** — если в диалоге (агент или пользователь) использован термин, которого нет в глоссарии, выводится диалог с предложением добавить его.
2. **Интерпретация** — агент предлагает свою формулировку, пользователь может её исправить, дополнить или подтвердить. Агент может слить оба варианта.
3. **Отказ** — если пользователь сказал «не надо», термин больше не предлагается.
4. **Дубликат** — если термин уже есть, выводится напоминание с его определением.
5. **Билингвальные термины** — если термин употребим и по-русски, и по-английски, создаются две строки. Русская строка ссылается на английскую: `см. Term`.
6. **Синонимы и аббревиатуры** — создаётся строка основного термина с перечислением всех вариантов в ключе. Для каждого варианта — отдельная строка-ссылка: `вар. — см. ОсновнойТермин`.
7. **Сортировка** — английские термины A–Z (case-insensitive), затем русские А–Я.

---

## English

### A

**Action** — тип CRUD-операции (`canRead`, `canCreate`, `canUpdate`, `canDelete`) в системе разрешений. Каждый флаг — булево поле в связке пользователя с DataArea. Определяет, что пользователь может делать с записями в данной области. См. *Permission*.

**API Route Group** — группа маршрутов API, сгруппированных по сущности: `/api/auth`, `/api/admin`, `/api/timelines`, `/api/events`, `/api/tags`, `/api/documents`, `/api/import-export`, `/api/pdf/export`, `/api/settings`.

**Audit Log** / **SysAuditLogTable** — таблица аудита действий пользователя. Типы событий: `register`, `login_success`, `login_fail`, `logout`, `change_password`, `update_profile`, `oauth_login`. Хранит IP, user-agent и опциональный JSON-метаданные.

### C

**CE / BCE Date System** — система эр: CE (Common Era, наша эра) и BCE (Before Common Era, до нашей эры). Отображение: `ДД.ММ.ГГГГ` для CE, `ДД.ММ.ГГГГ днэ` для BCE. Хранение: ISO `YYYY-MM-DD` с отрицательными годами для BCE.

### D

**DataArea** / **Data Area** — область данных, фундаментальная единица изоляции в многопользовательском режиме. Каждая запись (событие, шкала, тег, документ) привязана к DataArea. Пользователь получает доступ через Permission. При регистрации каждому пользователю создаётся Personal Data Area. См. *Permission*, *Personal Data Area*.

**DataAreaDto** — DTO области данных: `id`, `name`, `description`, `isPersonal`, `createdAt`.

**Dependency Curve** — кривая Безье на SVG-холсте между двумя связанными событиями. Показывается при наведении: оранжевый пунктир для `influences`/`influenced_by`, синяя сплошная для `part_of`/`contains`.

**Dependency Highlighting** — при наведении на событие все связанные с ним (зависимости и обратные зависимости) подсвечиваются: пунктирная рамка на канвасе и жёлтый фон в таблице событий.

**Dependency Tooltip** — тултип, отображающий связи события (исходящие и входящие) в виде списка. Показывается справа от основного тултипа при наведении на событие, у которого есть связи. Каждый элемент: тип связи (жирным) + имя связанного события. См. *связанный тултип*.

**DependencyType** — четыре типа связей между событиями: `part_of` (часть), `contains` (содержит), `influences` (влияет), `influenced_by` (подвержена влиянию). Работают комплементарными парами.

**DepFilterMode** — режим фильтрации в диалоге поиска зависимостей: `all` (показать все события) или `visible` (только видимые на экране с учётом активных фильтров и диапазона).

**Document** / **DocumentTable** — таблица документов-вложений, привязанных к событиям. Поля: описание, `originalLink` (оригинальный URL), `storageLink` (путь к файлу), `resourceType`. Связь с событиями — через *DocumentEventLink*.

**DocumentDto** — DTO документа: `documentId`, `description`, `originalLink`, `storageLink`, `resourceType`, `isPrimary`, `previewUrl`, `dataAreaId`, `createdDateTime`.

**Drizzle ORM** — ORM для PostgreSQL 17, используется в API. Миграции — в `apps/api/drizzle/`, генерируются командой `npm run db:generate`.

**DTO** / **Data Transfer Object** — объект передачи данных. Типизированная структура для обмена между API и клиентом. Все DTO проектов: *AuthResponse*, *AuthSettingsDto*, *DataAreaDto*, *UserDataAreaDto*, *TimelineDto*, *EventDto*, *EventDependencyDto*, *TagDto*, *DocumentDto*, *ImportResult*, *ExportFilters*, *UserDto*.

### E

**Event** / **EventTable** — основная сущность проекта. Хранит имя, дату начала, опциональную дату окончания и заметки (markdown). Отображается в виде полосы или точки на шкале времени. См. *TimelineEvent*.

**Event Bar Thickness** — визуальная толщина полосы события на канвасе: `normal` или `thick`. Используется для чередования в плотных кластерах перекрывающихся событий на одном треке.

**EventDependencyLink** — таблица связей событий (многие ко многим). Каждая запись: `eventId` (источник), `depEventId` (цель), `dependencyType`. См. *DependencyType*.

**EventDependencyDto** — DTO связи событий: `eventId`, `depEventId`, `dependencyType`, `createdDateTime`, `depEventName`.

**EventDto** — полный DTO события: `id`, `name`, `startDate`, `endDate`, `notes`, `createdDateTime`, `timelines[]`, `tags[]`, `documents[]`, `dependencies[]`, `dataAreaId`.

**Event Sheet** — полноэкранная выезжающая панель (компонент Sheet) создания/редактирования события. Вкладки: Основное, Приложения, Описание (markdown), Связи.

**Event Tooltip** / **Hover Card** — всплывающая карточка при наведении на событие на канвасе. Показывает имя, даты, превью изображения, markdown-заметки и чипы тегов. См. *тултип*.

**Event Track** / **Lane Track** — горизонтальный под-ряд внутри шкалы времени, куда помещаются полосы событий. Несколько событий на одной шкале распределяются по трекам (до 8) для избежания наложения.

**ExportFilters** — параметры фильтрации при XLSX-экспорте: `tagFilterIds[]`, `tagFilterMode`, `textSearchQuery`, `textSearchMode`, `dateFrom`, `dateTo`.

### F

**formatDisplay / parseDisplay / toStorage** — функции конвертации дат. `formatDisplay`: ISO (`YYYY-MM-DD`) → русский формат (`ДД.ММ.ГГГГ`). `parseDisplay`: обратно. `toStorage`: сборка ISO из частей (год/месяц/день) с поддержкой BCE. См. *CE/BCE Date System*.

**formatCenturyYear** — функция, форматирующая года, попадающие ровно на границу века (1900, 2000 и т.д.), римскими цифрами: `XX в`, `XXI в`.

### H

**HistoricalDate** — тип разобранной исторической даты: `year`, `month`, `day`, `era` (`CE` | `BCE`). Поддерживает даты до нашей эры (отрицательные года) для древней истории.

### I

**ImportResult** — результат XLSX-импорта: `created` (количество), `updated`, `skipped`, `errors[]` (массив `{row, message}`).

### J

**JWT** / **JSON Web Token** — токен аутентификации (HS256). Access token: 24 часа, httpOnly cookie. Refresh token: 30 дней, httpOnly cookie, с ротацией и отзывом. См. *Token Rotation*.

### L

**LabelItem** — элемент разметки для отображения имён событий на канвасе: `id`, `x` (позиция), `text` (имя), `row` (назначенный ряд для избежания наложения).

### M

**Migration** — автоматически генерируемые SQL-миграции (Drizzle). Хранятся в `apps/api/drizzle/`, коммитятся в Git. Команда: `npm run db:migrate`.

### O

**OAuth** — протокол внешней аутентификации. Активный провайдер: Яндекс. Заготовки: VK, Google. Двухшаговый flow: редирект на провайдера → callback устанавливает куки и temp code → фронтенд обменивает temp code на данные пользователя.

**OAuthProvider** — интерфейс провайдера внешней аутентификации. Каждый провайдер (Yandex, VK, Google) реализует `getAuthUrl`, `exchangeCode`, `getUserInfo`.

**OAuthUserInfo** — нормализованные данные пользователя от OAuth-провайдера: `provider`, `providerId`, `email`, `firstName`, `lastName`.

### P

**Pending Document** — документ, добавленный по URL при создании события, но ещё не сохранённый в БД. Хранится в локальном состоянии до сохранения события.

**Permission** / **SysUserDataArea** — матрица разрешений. Связка пользователя с DataArea содержит четыре булевых флага: `canRead`, `canCreate`, `canUpdate`, `canDelete`. Проверяется перед каждой мутацией через *permissionService*. См. *Action*, *DataArea*.

**permissionService** — сервис проверки прав. Функции: `checkPermission(userId, dataAreaId, action)`, `getAllowedDataAreaIds(userId, action?)`, `getCurrentDataAreaId(userId)`.

**Personal Data Area** — автоматически создаваемая DataArea при регистрации пользователя (имя: `user-{login}-personal`). Пользователь имеет полные CRUD-права. Не может быть удалена через админку.

**Primary Document** — документ, помеченный как основной/главный для события. Используется как превью в тултипах и карточке события. Только один документ на событие может быть основным.

### R

**Rate Limiter** — in-memory ограничитель запросов на API. Сброс: `npm run rate-limit:reset`.

**Refresh Token** / **SysRefreshTokenTable** — таблица refresh-токенов JWT. Хранит хеш токена, дату истечения, IP, user-agent, дату отзыва. Используется для *Token Rotation*. Очистка: `npm run db:cleanup-tokens`.

**ResourceType** — тип документа-вложения: `image`, `video`, `pdf`, `other`. Определяет отображение (превью или иконка).

### S

**Seed** — скрипты начального заполнения БД. `seed.ts` (быстрый): админ + тестовый пользователь. `seed-full.ts`: ~60 исторических событий. Команда: `npm run db:seed`.

**SMTP** / **Nodemailer** — отправка писем (подтверждение email, сброс пароля) через Яндекс.Почту.

**SortField** — поле сортировки в таблице EventGrid: `name`, `startDate`, `endDate`.

**SysCounterTable** — таблица-счётчик для генерации серийных кодов пользователей (формат: `U000001`).

**SysExternalLoginTable** — таблица привязки внешних OAuth-аккаунтов к внутренним пользователям: `provider`, `providerId`.

**SysUserTable** — таблица пользователей: `login`, `email`, `passwordHash`, `name`, `isActive`, `emailConfirmed`, `defaultDataAreaId`.

**SysUserSettingsTable** — таблица настроек пользователя: `currentDataAreaId` (текущая выбранная DataArea).

### T

**Tag** / **TagTable** — таблица тегов. Теги — цветные метки (целочисленный `color`) для категоризации и фильтрации событий. Поддерживают опциональное превью-изображение.

**Tag Chip** — UI-компонент компактного отображения тега: цветной индикатор или превью + имя + кнопка удаления. Используется в фильтрах и формах.

**TagDto** — DTO тега: `id`, `name`, `color`, `previewUrl`, `dataAreaId`, `createdDateTime`.

**TagFilterMode** — режим фильтрации по тегам: `and` (событие должно иметь ВСЕ выбранные теги) или `or` (событие должно иметь ЛЮБОЙ выбранный тег).

**TanStack Query** — клиентский менеджер запросов (React). `staleTime: 30_000` мс.

**TextSearchMode** — область поиска: `name` (только имена событий) или `nameAndNotes` (имена + заметки markdown).

**Timeline** / **TimelineTable** — шкала времени. Именованный горизонтальный ряд на канвасе, группирующий связанные события. Поля: имя, описание, `iconUrl`, `sortIndex`. См. *Timeline Lane*, *шкала времени*.

**TimelineDto** — DTO шкалы: `id`, `name`, `description`, `iconUrl`, `sortIndex`, `visible` (из UserPreferences), `dataAreaId`, `createdDateTime`.

**Timeline Lane** — горизонтальный ряд на SVG-канвасе, представляющий одну шкалу времени. Содержит метку слева, осевую линию и полосы событий.

**Timeline Tick** — временная метка на оси X канваса. Генерируется динамически в зависимости от диапазона: от дней (короткий диапазон) до тысячелетий (диапазон >10 000 лет).

**Token Rotation** — паттерн безопасности: при каждом обновлении refresh-токена старый отзывается (устанавливается `revokedAt`) и создаётся новый. Повторное использование старого токена после ротации делает его невалидным.

### U

**UI Settings Persistence** — сохранение состояния интерфейса на сервер через AppSettings (ключи с префиксом `ui.`): `ui.tagFilters`, `ui.viewRange`, `ui.lastEditedEventId`, `ui.textSearch`, `ui.showTagsOnTimeline`, `ui.highlightDependencies`, `ui.viewMode`, `ui.gridWidth`.

**User Preferences** — настройки видимости шкал для конкретного пользователя. Какая шкала показана/скрыта на канвасе.

**UserDataAreaDto** — DTO назначения прав: `userId`, `dataAreaId`, `canRead`, `canCreate`, `canUpdate`, `canDelete`, `dataAreaName`, `userLogin`.

**UserDto** — DTO пользователя: `id`, `login`, `email`, `firstName`, `lastName`, `isActive`, `emailConfirmed`, `defaultDataAreaId`, `createdAt`.

**User Serial Code** — авто-генерируемый идентификатор пользователя: `U` + 6 цифр (например, `U000001`). Используется как login для пользователей, созданных админом.

### V

**ViewMode** — режим отображения: `timeline` (SVG-канвас со шкалами) или `grid` (таблица событий с детальной панелью).

**ViewRange** — область просмотра канваса: `startMs` и `endMs` в миллисекундах. Определяет видимый временной диапазон. Поддерживает BCE через отрицательные значения JS Date.

### X

**XLSX Import / Export** — Excel-портативность данных. Экспорт: XLSX с опциональными фильтрами (теги, текст, даты). Импорт: парсинг XLSX с созданием/обновлением событий и связей. Результат: *ImportResult*.

### Z

**Zod** — библиотека валидации схем. Единый источник истины типов в `packages/shared/`. Все схемы: `*CreateSchema`, `*UpdateSchema`, `loginSchema`, `registerSchema` и т.д.

---

## Русский

### А

**аудит** — см. *Audit Log*.

### Г

**глоссарий** / **GLOSSARY** — настоящий файл `docs/GLOSSARY.md`. Ведущийся по правилам, описанным в начале. Любой новый термин в диалоге предлагается к добавлению.

### Д

**действие** — см. *Action*.

**диапазон просмотра** — см. *ViewRange*.

**документ** — см. *Document*.

**ДРИЗЛ** / **Drizzle** — см. *Drizzle ORM*.

**DTO** / **ДТО** — см. *DTO*.

### З

**зависимость событий** — см. *EventDependencyLink*, *DependencyType*.

### И

**импорт/экспорт XLSX** — см. *XLSX Import/Export*.

### К

**карточка события** — см. *Event Sheet*.

**кривая зависимости** — см. *Dependency Curve*.

### М

**миграция** — см. *Migration*.

### Н

**нотификация** / **Toast** — всплывающее уведомление в UI (успех/ошибка операции).

### О

**область данных** — см. *DataArea*.

### П

**персональная область данных** — см. *Personal Data Area*.

**права / разрешение** — см. *Permission*, *Action*.

### Р

**режим просмотра** — см. *ViewMode*.

**ротация токенов** — см. *Token Rotation*.

### С

**связанный тултип** / **dependency tooltip** — см. *Dependency Tooltip*.

**сид** / **сидирование** — см. *Seed*.

**событие** — см. *Event*, *TimelineEvent*.

### Т

**таймлайн** — см. *Timeline*.

**тег** — см. *Tag*.

**трек события** — см. *Event Track*.

**тултип** / **подсказка** — см. *Event Tooltip*.

### Ц

**цветовая схема** / **Theme** — светлая/тёмная тема интерфейса. Переключается в настройках пользователя.

**чип тега** — см. *Tag Chip*.

### Ч

**числовая шкала** / **Tick** — см. *Timeline Tick*.

### Ш

**шкала времени** — см. *Timeline*, *Timeline Lane*.
