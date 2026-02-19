# Инструкция по установке XimFinance

## Требования

- Node.js 18 или выше
- PostgreSQL 14 или выше
- npm или yarn

## Шаг 1: Установка PostgreSQL

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Создание базы данных
```bash
psql postgres
```

В консоли PostgreSQL выполните:
```sql
CREATE DATABASE ximfinance;
CREATE USER ximfinance_user WITH PASSWORD 'ximfinance_pass';
GRANT ALL PRIVILEGES ON DATABASE ximfinance TO ximfinance_user;
\q
```

## Шаг 2: Установка зависимостей

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd ../frontend
npm install
```

## Шаг 3: Запуск приложения

Откройте два терминала:

### Терминал 1 - Backend
```bash
cd backend
npm run dev
```

Backend запустится на http://localhost:3001

### Терминал 2 - Frontend
```bash
cd frontend
npm run dev
```

Frontend запустится на http://localhost:5173

## Шаг 4: Открытие приложения

Откройте браузер и перейдите по адресу:
```
http://localhost:5173
```

## Возможные проблемы

### Ошибка подключения к базе данных

Проверьте, что PostgreSQL запущен:
```bash
brew services list
```

Если не запущен, запустите:
```bash
brew services start postgresql@14
```

### Порт уже занят

Если порт 3001 или 5173 уже используется, измените порты в файлах:
- Backend: `backend/.env` → измените `PORT`
- Frontend: `frontend/vite.config.ts` → измените `server.port`

### База данных не существует

Убедитесь, что вы создали базу данных согласно Шагу 1.

## Альтернативный запуск с Docker

Если у вас установлен Docker:

```bash
docker-compose up
```

Приложение будет доступно на http://localhost

## Следующие шаги

После успешного запуска:

1. Создайте несколько категорий (Категории → Добавить категорию)
2. Добавьте контрагентов (Контрагенты → Добавить контрагента)
3. Начните вводить транзакции (Транзакции → Добавить транзакцию)
4. Смотрите отчеты (Отчёты и аналитика)

Приятной работы!
