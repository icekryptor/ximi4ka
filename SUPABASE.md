# Подключение Supabase (PostgreSQL)

Бэкенд поддерживает Supabase через переменную `DATABASE_URL`. TypeORM при старте создаст таблицы (`synchronize: true` в development).

## Шаги

### 1. Создать проект в Supabase

1. Зайти на [supabase.com](https://supabase.com) → **Start your project**.
2. **New project** — указать организацию, имя проекта, пароль БД (сохранить пароль).
3. Выбрать регион и дождаться создания проекта.

### 2. Взять строку подключения

1. В проекте: **Project Settings** (иконка шестерёнки) → **Database**.
2. В блоке **Connection string** выбрать **URI**.
3. Вставить **Connection pooling** (порт **6543**) — он подходит для приложения.
4. В строке заменить `[YOUR-PASSWORD]` на пароль БД из шага 1.

Пример (подставьте свой пароль и хост из дашборда):

```txt
postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### 3. Настроить backend

В папке `backend` создать или отредактировать `.env`:

```env
PORT=3001
DATABASE_URL=postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres
NODE_ENV=development
```

Остальные переменные (JWT и т.д.) — по желанию; для локальной разработки можно не менять.

### 4. Запустить бэкенд и сиды

```bash
cd backend
npm run dev
```

При первом запуске TypeORM создаст таблицы. Затем в **другом терминале** можно заполнить данные:

```bash
cd backend
npm run seed
npm run seed:cost
```

### 5. Проверка

- В Supabase: **Table Editor** — должны появиться таблицы и данные после сидов.
- Локально: фронт на `http://localhost:5173`, API на `http://localhost:3001`.

## Важно

- **Пароль** из Supabase храните только в `.env`; `.env` в репозиторий не коммитить.
- Для продакшена отключите `synchronize` (используйте миграции) и задайте `NODE_ENV=production`.
