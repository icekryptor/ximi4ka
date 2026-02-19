# Архитектура XimFinance

## 🏛️ Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                  (React + TypeScript)                        │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Dashboard  │  │Transactions│  │Counterparty│            │
│  └────────────┘  └────────────┘  └────────────┘            │
│  ┌────────────┐  ┌────────────┐                            │
│  │ Categories │  │  Reports   │                            │
│  └────────────┘  └────────────┘                            │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │           API Client Layer                  │            │
│  │  (axios + typed interfaces)                 │            │
│  └────────────────────────────────────────────┘            │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/REST
                       │ (JSON)
┌──────────────────────▼───────────────────────────────────────┐
│                         Backend                              │
│               (Node.js + Express + TypeORM)                  │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │           Express Routes                    │            │
│  │  /api/transactions                          │            │
│  │  /api/counterparties                        │            │
│  │  /api/categories                            │            │
│  │  /api/reports                               │            │
│  └────────────┬───────────────────────────────┘            │
│               │                                              │
│  ┌────────────▼───────────────────────────────┐            │
│  │         Controllers                         │            │
│  │  (Business Logic)                           │            │
│  │  - transactionController                    │            │
│  │  - counterpartyController                   │            │
│  │  - categoryController                       │            │
│  │  - reportController                         │            │
│  └────────────┬───────────────────────────────┘            │
│               │                                              │
│  ┌────────────▼───────────────────────────────┐            │
│  │         TypeORM Entities                    │            │
│  │  (Data Models)                              │            │
│  │  - Transaction                              │            │
│  │  - Counterparty                             │            │
│  │  - Category                                 │            │
│  └────────────┬───────────────────────────────┘            │
└───────────────┼──────────────────────────────────────────────┘
                │
                │ TypeORM
                │
┌───────────────▼──────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │transactions │  │counterparties│ │ categories  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Поток данных

### Создание транзакции

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Frontend │────▶│ Backend  │────▶│ Database │
│  (UI)    │     │ (React)  │     │ (Express)│     │ (Postgres)
└──────────┘     └──────────┘     └──────────┘     └──────────┘
    │                 │                 │                 │
    │ 1. Заполняет   │                 │                 │
    │    форму       │                 │                 │
    │                 │                 │                 │
    │ 2. Нажимает    │                 │                 │
    │    "Создать"   │                 │                 │
    ├────────────────▶│ 3. POST        │                 │
    │                 │    /api/trans.. │                │
    │                 ├────────────────▶│ 4. Валидация  │
    │                 │                 │    данных      │
    │                 │                 │                 │
    │                 │                 │ 5. INSERT      │
    │                 │                 ├────────────────▶│
    │                 │                 │                 │
    │                 │                 │◀────────────────┤
    │                 │                 │ 6. Созданная   │
    │                 │                 │    запись      │
    │                 │◀────────────────┤                │
    │                 │ 7. JSON ответ  │                 │
    │◀────────────────┤                 │                 │
    │ 8. Обновление  │                 │                 │
    │    UI          │                 │                 │
    │                 │                 │                 │
```

### Получение отчетов

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Frontend │────▶│ Backend  │────▶│ Database │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
    │                 │                 │                 │
    │ 1. Выбирает    │                 │                 │
    │    период      │                 │                 │
    ├────────────────▶│ 2. GET         │                 │
    │                 │    /api/reports│                 │
    │                 │    ?startDate  │                 │
    │                 │    &endDate    │                 │
    │                 ├────────────────▶│ 3. Агрегация  │
    │                 │                 │    данных      │
    │                 │                 │                 │
    │                 │                 │ 4. SELECT      │
    │                 │                 │    + GROUP BY  │
    │                 │                 ├────────────────▶│
    │                 │                 │                 │
    │                 │                 │◀────────────────┤
    │                 │                 │ 5. Результаты  │
    │                 │◀────────────────┤                │
    │                 │ 6. JSON ответ  │                 │
    │◀────────────────┤                 │                 │
    │ 7. Отрисовка   │                 │                 │
    │    графиков    │                 │                 │
```

## 🔐 Слои безопасности

```
┌─────────────────────────────────────────┐
│          Frontend                        │
│  ✓ Валидация форм                       │
│  ✓ Проверка обязательных полей          │
│  ✓ Форматирование данных                │
└────────────┬────────────────────────────┘
             │
             │ HTTPS (в production)
             │
┌────────────▼────────────────────────────┐
│          Backend                         │
│  ✓ Helmet.js (HTTP security headers)    │
│  ✓ CORS (разрешенные домены)            │
│  ✓ Express валидация                    │
│  ✓ TypeScript типизация                 │
└────────────┬────────────────────────────┘
             │
             │ Prepared Statements
             │ (TypeORM)
             │
┌────────────▼────────────────────────────┐
│          Database                        │
│  ✓ Пользовательские права               │
│  ✓ Ограничения на уровне БД             │
│  ✓ Индексы для производительности       │
└─────────────────────────────────────────┘
```

## 🗂️ Структура компонентов Frontend

```
src/
├── api/                      # API слой
│   ├── client.ts            # Axios instance + interceptors
│   ├── types.ts             # TypeScript интерфейсы
│   ├── transactions.ts      # Транзакции API
│   ├── counterparties.ts    # Контрагенты API
│   ├── categories.ts        # Категории API
│   └── reports.ts           # Отчеты API
│
├── components/               # Переиспользуемые компоненты
│   ├── Layout.tsx           # Общий макет + навигация
│   ├── TransactionModal.tsx # Модалка транзакций
│   ├── CounterpartyModal.tsx# Модалка контрагентов
│   └── CategoryModal.tsx    # Модалка категорий
│
├── pages/                    # Страницы приложения
│   ├── Dashboard.tsx        # Главная панель
│   ├── Transactions.tsx     # Управление транзакциями
│   ├── Counterparties.tsx   # Управление контрагентами
│   ├── Categories.tsx       # Управление категориями
│   └── Reports.tsx          # Отчеты и аналитика
│
├── App.tsx                  # Роутинг
├── main.tsx                 # Точка входа
└── index.css                # Глобальные стили
```

## 🗄️ Структура Backend

```
src/
├── config/                   # Конфигурация
│   └── database.ts          # TypeORM DataSource
│
├── entities/                 # Модели данных
│   ├── Transaction.ts       # Транзакции
│   ├── Counterparty.ts      # Контрагенты
│   └── Category.ts          # Категории
│
├── controllers/              # Контроллеры
│   ├── transaction.controller.ts
│   ├── counterparty.controller.ts
│   ├── category.controller.ts
│   └── report.controller.ts
│
├── routes/                   # Роуты
│   ├── transaction.routes.ts
│   ├── counterparty.routes.ts
│   ├── category.routes.ts
│   └── report.routes.ts
│
├── seeds/                    # Начальные данные
│   └── initial-data.ts
│
└── server.ts                 # Точка входа
```

## 🔄 Жизненный цикл запроса

### GET /api/transactions

```
Request: GET /api/transactions?type=income&startDate=2024-01-01

1. Express Router
   ↓
2. Transaction Routes
   ↓
3. Transaction Controller.getAll()
   ↓
4. TypeORM Repository
   ↓
5. SQL Query: SELECT * FROM transactions WHERE...
   ↓
6. PostgreSQL Database
   ↓
7. Result Rows
   ↓
8. TypeORM Entity Mapping
   ↓
9. Controller Response (JSON)
   ↓
10. Express Response

Response: 200 OK + [{ id, type, amount, ... }]
```

## 📡 REST API Endpoints

```
Транзакции
├── GET    /api/transactions          # Список с фильтрами
├── GET    /api/transactions/:id      # Одна транзакция
├── POST   /api/transactions          # Создать
├── PUT    /api/transactions/:id      # Обновить
└── DELETE /api/transactions/:id      # Удалить

Контрагенты
├── GET    /api/counterparties        # Список с фильтрами
├── GET    /api/counterparties/:id    # Один контрагент
├── POST   /api/counterparties        # Создать
├── PUT    /api/counterparties/:id    # Обновить
└── DELETE /api/counterparties/:id    # Удалить

Категории
├── GET    /api/categories            # Список с фильтрами
├── GET    /api/categories/:id        # Одна категория
├── POST   /api/categories            # Создать
├── PUT    /api/categories/:id        # Обновить
└── DELETE /api/categories/:id        # Удалить

Отчеты
├── GET    /api/reports/summary       # Финансовая сводка
├── GET    /api/reports/by-category   # По категориям
└── GET    /api/reports/by-counterparty # По контрагентам
```

## 🔍 Связи между таблицами

```
┌─────────────┐        ┌─────────────┐
│ categories  │◀───┐   │counterparties
└─────────────┘    │   └─────────────┘
                   │          ▲
                   │          │
                   │          │
              ┌────┴──────────┴────┐
              │    transactions    │
              │                    │
              │  category_id (FK)  │
              │  counterparty_id   │
              └────────────────────┘
```

## 💾 Типы данных

### Transaction
```typescript
{
  id: string (UUID)
  type: 'income' | 'expense'
  amount: number (decimal)
  description: string
  date: Date
  category_id?: string (UUID)
  category?: Category (relation)
  counterparty_id?: string (UUID)
  counterparty?: Counterparty (relation)
  document_number?: string
  notes?: string
  created_at: Date
  updated_at: Date
}
```

### Category
```typescript
{
  id: string (UUID)
  name: string
  type: 'income' | 'expense'
  color?: string (hex)
  description?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}
```

### Counterparty
```typescript
{
  id: string (UUID)
  name: string
  type: 'supplier' | 'customer' | 'both'
  inn?: string
  address?: string
  phone?: string
  email?: string
  contact_person?: string
  notes?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}
```

## 🎨 UI Component Flow

```
Layout
  ├── Sidebar Navigation
  │   ├── Dashboard Link
  │   ├── Transactions Link
  │   ├── Counterparties Link
  │   ├── Categories Link
  │   └── Reports Link
  │
  └── Main Content
      ├── Dashboard Page
      │   ├── Stats Cards (4)
      │   └── Recent Transactions List
      │
      ├── Transactions Page
      │   ├── Filters
      │   ├── Search
      │   ├── Transactions Table
      │   └── TransactionModal
      │
      ├── Counterparties Page
      │   ├── Search
      │   ├── Counterparty Cards Grid
      │   └── CounterpartyModal
      │
      ├── Categories Page
      │   ├── Type Filter
      │   ├── Category Cards Grid
      │   └── CategoryModal
      │
      └── Reports Page
          ├── Date Range Filter
          ├── Type Filter
          ├── Stats Cards (3)
          ├── Charts (Bar + Pie)
          └── Tables (Category + Counterparty)
```

## 🚀 Deployment Flow

```
Development
  ├── npm run dev (backend)
  ├── npm run dev (frontend)
  └── PostgreSQL local

Production (Docker)
  ├── Backend Container
  │   ├── npm run build
  │   └── npm start
  │
  ├── Frontend Container
  │   ├── npm run build
  │   └── nginx serve
  │
  └── PostgreSQL Container
      └── persistent volume
```

---

**Дата:** 16 февраля 2024
**Версия:** 1.0.0
