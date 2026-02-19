# XimFinance - Система финансового управления

Современный микросервис для управления финансами компании по производству химических наборов для опытов.

![XimFinance](https://img.shields.io/badge/XimFinance-v1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🎯 Возможности

- 🧪 **Расчет себестоимости** - Детальный расчет себестоимости наборов с разбивкой по компонентам
- 📊 **Управление транзакциями** - Учет доходов и расходов с детальной информацией
- 💰 **Финансовая аналитика** - Интерактивные графики и отчеты
- 👥 **Контрагенты** - Управление поставщиками и клиентами
- 🏷️ **Категории** - Гибкая система категоризации операций
- 📈 **Отчеты** - Детальные отчеты по категориям и контрагентам
- 🎨 **Минималистичный UI** - Чистый интерфейс на русском языке
- 🔍 **Поиск и фильтры** - Удобный поиск и фильтрация данных

## 📁 Структура проекта

```
ximfinance/
├── backend/                    # Backend сервер
│   ├── src/
│   │   ├── config/            # Конфигурация (БД)
│   │   ├── entities/          # Модели данных (TypeORM)
│   │   ├── controllers/       # Бизнес-логика
│   │   ├── routes/            # API маршруты
│   │   ├── seeds/             # Начальные данные
│   │   └── server.ts          # Точка входа
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Frontend приложение
│   ├── src/
│   │   ├── api/               # API клиенты
│   │   ├── components/        # React компоненты
│   │   ├── pages/             # Страницы приложения
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml         # Docker конфигурация
├── start.sh                   # Скрипт быстрого старта
├── SETUP.md                   # Детальная инструкция
└── README.md
```

## 🚀 Быстрый старт

### Автоматический запуск (рекомендуется)

```bash
./start.sh
```

Скрипт автоматически:
- Проверит наличие Node.js и PostgreSQL
- Установит зависимости
- Создаст .env файлы
- Запустит оба сервера

### Ручной запуск

#### 1. Установка PostgreSQL (macOS)

```bash
brew install postgresql@14
brew services start postgresql@14

# Создание базы данных
psql postgres
CREATE DATABASE ximfinance;
CREATE USER ximfinance_user WITH PASSWORD 'ximfinance_pass';
GRANT ALL PRIVILEGES ON DATABASE ximfinance TO ximfinance_user;
\q
```

#### 2. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

#### 3. Настройка окружения

Backend `.env` уже создан, но вы можете изменить параметры в `backend/.env`

Frontend `.env` уже создан для работы с локальным API

#### 4. Инициализация данных

**Базовые данные (категории и контрагенты):**
```bash
cd backend
npm run seed
```

**Данные расчета себестоимости (компоненты и наборы):**
```bash
npm run seed:cost
```

Это создаст:
- 20 реактивов
- 15 комплектующих  
- 7 элементов печатной продукции
- 3 позиции работы
- Набор "Химичка" с себестоимостью 1124,14₽

#### 5. Запуск

Откройте два терминала:

**Терминал 1 - Backend:**
```bash
cd backend
npm run dev
```
Сервер запустится на http://localhost:3001

**Терминал 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Приложение откроется на http://localhost:5173

## 🐳 Запуск с Docker

```bash
docker-compose up
```

Приложение будет доступно на http://localhost

## 🛠️ Технологии

### Frontend
- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **Vite** - Сборщик проектов
- **TailwindCSS** - Стилизация
- **React Router** - Маршрутизация
- **Axios** - HTTP клиент
- **Recharts** - Графики и диаграммы
- **Lucide React** - Иконки
- **date-fns** - Работа с датами

### Backend
- **Node.js** - Runtime
- **Express** - Web фреймворк
- **TypeScript** - Типизация
- **PostgreSQL** - База данных
- **TypeORM** - ORM
- **Helmet** - Безопасность
- **Morgan** - Логирование

## 📖 API Документация

### Endpoints

#### Транзакции
- `GET /api/transactions` - Получить все транзакции
- `GET /api/transactions/:id` - Получить транзакцию по ID
- `POST /api/transactions` - Создать транзакцию
- `PUT /api/transactions/:id` - Обновить транзакцию
- `DELETE /api/transactions/:id` - Удалить транзакцию

#### Контрагенты
- `GET /api/counterparties` - Получить всех контрагентов
- `GET /api/counterparties/:id` - Получить контрагента по ID
- `POST /api/counterparties` - Создать контрагента
- `PUT /api/counterparties/:id` - Обновить контрагента
- `DELETE /api/counterparties/:id` - Удалить контрагента

#### Категории
- `GET /api/categories` - Получить все категории
- `GET /api/categories/:id` - Получить категорию по ID
- `POST /api/categories` - Создать категорию
- `PUT /api/categories/:id` - Обновить категорию
- `DELETE /api/categories/:id` - Удалить категорию

#### Отчеты
- `GET /api/reports/summary` - Финансовая сводка
- `GET /api/reports/by-category` - Отчет по категориям
- `GET /api/reports/by-counterparty` - Отчет по контрагентам

## 💡 Использование

### Первые шаги

1. **Создайте категории** (или используйте `npm run seed` в backend)
   - Перейдите в раздел "Категории"
   - Создайте категории для доходов (например: "Продажа наборов")
   - Создайте категории для расходов (например: "Закупка сырья")

2. **Добавьте контрагентов**
   - Перейдите в раздел "Контрагенты"
   - Добавьте поставщиков и клиентов

3. **Начните вести учет**
   - Перейдите в раздел "Транзакции"
   - Создавайте записи о доходах и расходах

4. **Анализируйте данные**
   - Раздел "Отчёты" покажет финансовую аналитику
   - Графики по категориям и контрагентам
   - Финансовая сводка за период

## 🔧 Разработка

### Структура базы данных

**Таблицы:**
- `transactions` - Финансовые операции
- `counterparties` - Контрагенты (поставщики/клиенты)
- `categories` - Категории операций

### Добавление новых функций

1. **Backend:**
   - Создайте entity в `backend/src/entities/`
   - Добавьте controller в `backend/src/controllers/`
   - Создайте routes в `backend/src/routes/`
   - Подключите route в `backend/src/server.ts`

2. **Frontend:**
   - Создайте API функции в `frontend/src/api/`
   - Добавьте компоненты в `frontend/src/components/`
   - Создайте страницу в `frontend/src/pages/`
   - Добавьте маршрут в `frontend/src/App.tsx`

## 🐛 Устранение проблем

Смотрите [SETUP.md](./SETUP.md) для детальной информации по установке и решению проблем.

## 📝 Лицензия

Внутреннее использование компании

## 👥 Поддержка

При возникновении проблем:
1. Проверьте логи в `backend.log` и `frontend.log`
2. Убедитесь, что PostgreSQL запущен
3. Проверьте настройки в `.env` файлах

---

Разработано для компании по производству химических наборов 🧪
# ximi4ka_finance
