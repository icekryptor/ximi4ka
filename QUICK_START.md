# 🚀 Быстрый старт XimFinance

## Самый простой способ

```bash
./start.sh
```

Откройте http://localhost:5173 в браузере

## Пошаговая инструкция

### 1. Установите PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Создайте базу данных:**
```bash
psql postgres -c "CREATE DATABASE ximfinance;"
psql postgres -c "CREATE USER ximfinance_user WITH PASSWORD 'ximfinance_pass';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE ximfinance TO ximfinance_user;"
```

### 2. Установите зависимости

Зависимости уже установлены! Если нет:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Добавьте начальные данные (опционально)

```bash
cd backend
npm run seed
```

Это создаст:
- 13 категорий (доходы и расходы)
- 4 примера контрагентов

### 4. Запустите приложение

**Вариант 1 - Автоматически:**
```bash
./start.sh
```

**Вариант 2 - Вручную (2 терминала):**

Терминал 1:
```bash
cd backend
npm run dev
```

Терминал 2:
```bash
cd frontend
npm run dev
```

### 5. Откройте приложение

Перейдите по адресу: **http://localhost:5173**

## 🎯 Что дальше?

1. **Изучите интерфейс:**
   - Главная - обзор финансов
   - Транзакции - добавьте доходы/расходы
   - Контрагенты - управление поставщиками/клиентами
   - Категории - настройка категорий
   - Отчёты - финансовая аналитика

2. **Добавьте первую транзакцию:**
   - Перейдите в "Транзакции"
   - Нажмите "Добавить транзакцию"
   - Заполните форму
   - Сохраните

3. **Посмотрите отчеты:**
   - Перейдите в "Отчёты и аналитика"
   - Выберите период
   - Изучите графики и таблицы

## ❓ Проблемы?

### Backend не запускается
```bash
# Проверьте PostgreSQL
brew services list
# Если не запущен:
brew services start postgresql@14
```

### Порт занят
Измените порт в:
- Backend: `backend/.env` → `PORT=3002`
- Frontend: `frontend/vite.config.ts` → `server.port: 5174`

### База данных не найдена
```bash
# Создайте заново
psql postgres -c "CREATE DATABASE ximfinance;"
```

## 📚 Дополнительная информация

- Полная документация: [README.md](./README.md)
- Детальная установка: [SETUP.md](./SETUP.md)

---

**Приятной работы! 🎉**
