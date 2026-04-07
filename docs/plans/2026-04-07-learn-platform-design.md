# XimiLearn — Образовательная платформа по химии

**Дата:** 2026-04-07
**Домен:** learn.ximi4ka.ru
**Статус:** Утверждён

---

## 1. Обзор проекта

Образовательная платформа для учеников, привязанная к наборам Ximi4ka. Модульная система с теорией по химии, объяснением реакций и решением задач из школьной программы.

### Монетизация

| Тариф | Цена | Доступ |
|-------|------|--------|
| Без оплаты | 0₽ | Каталог модулей + превью уроков |
| Подписка BASE | 999₽/мес | Все модули с tier=base |
| Подписка BASE (промо) | 499₽/мес + 1 мес бесплатно | Промокод из набора |
| Premium-модуль | Разовая покупка (цена индивидуальна) | Конкретный модуль навсегда |

---

## 2. Стек технологий

- **Framework:** Next.js 14 (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Оплата:** ЯндексPay
- **Формулы:** KaTeX (с `mhchem` для химических формул `\ce{}`)
- **Rich-text редактор:** Tiptap (headless, JSON output)
- **Drag-n-drop:** @dnd-kit/core
- **Деплой:** Vercel (субдомен learn.ximi4ka.ru)
- **Стиль:** TailwindCSS, дизайн-система от ximi4ka.ru

### Дизайн-система

- Primary: `#836efe`
- Gradient: `rgba(141,103,255,1)` → `rgba(200,86,255,1)`
- Dark accent: `#6703ff`
- Border radius: large rounded (40-55px)
- Font: Arial
- Mobile-first

---

## 3. Архитектура

```
learn.ximi4ka.ru
├── Next.js 14 (App Router)
│   ├── /app              — публичные страницы (SSR/SSG для SEO)
│   │   ├── /(auth)       — регистрация, вход, восстановление пароля
│   │   ├── /(public)     — каталог модулей, превью уроков
│   │   ├── /(learn)      — личный кабинет, прохождение уроков, задачи
│   │   └── /(admin)      — админ-панель (редактор контента)
│   ├── /api              — API routes (webhook ЯндексPay, промокоды)
│   └── /components       — UI-компоненты
│
├── Supabase
│   ├── Auth              — email/password авторизация
│   ├── Database          — контент, пользователи, подписки, прогресс
│   ├── Storage           — изображения, схемы реакций
│   └── RLS               — Row Level Security
│
├── Интеграции
│   ├── ЯндексPay         — оплата подписок и модулей
│   └── KaTeX             — рендер химических формул
│
└── Деплой: Vercel
```

---

## 4. Модель данных

### Контент

**modules**
- `id` (uuid, PK)
- `title` (text)
- `slug` (text, unique)
- `description` (text)
- `cover_image_url` (text)
- `tier` (enum: base | premium)
- `price` (numeric, для premium)
- `order_index` (int)
- `is_published` (boolean)
- `created_at` (timestamptz)

**lessons**
- `id` (uuid, PK)
- `module_id` (FK → modules)
- `title` (text)
- `slug` (text)
- `order_index` (int)
- `duration_minutes` (int)
- `is_published` (boolean)
- `created_at` (timestamptz)

**content_blocks**
- `id` (uuid, PK)
- `lesson_id` (FK → lessons)
- `type` (enum: text | formula | image | task | video)
- `content` (jsonb)
- `order_index` (int)
- `created_at` (timestamptz)

### Задачи

**tasks**
- `id` (uuid, PK)
- `content_block_id` (FK → content_blocks)
- `type` (enum: single_choice | multiple_choice | numeric_input | equation_balance)
- `question` (text)
- `explanation` (text)
- `difficulty` (int, 1-5)
- `points` (int)
- `created_at` (timestamptz)

**task_options**
- `id` (uuid, PK)
- `task_id` (FK → tasks)
- `text` (text)
- `is_correct` (boolean)
- `order_index` (int)

### Пользователи и подписки

**profiles**
- `id` (uuid, PK, = auth.users.id)
- `display_name` (text)
- `avatar_url` (text)
- `created_at` (timestamptz)

**subscriptions**
- `id` (uuid, PK)
- `user_id` (FK → profiles)
- `plan` (enum: base | base_promo)
- `status` (enum: active | cancelled | expired)
- `started_at` (timestamptz)
- `expires_at` (timestamptz)
- `yandex_pay_id` (text)
- `created_at` (timestamptz)

**promo_codes**
- `id` (uuid, PK)
- `code` (text, unique) — формат XIMI-XXXX-XXXX
- `discount_plan` (enum: base_promo)
- `free_months` (int, default 1)
- `is_used` (boolean)
- `used_by` (FK → profiles, nullable)
- `created_at` (timestamptz)

**module_purchases**
- `id` (uuid, PK)
- `user_id` (FK → profiles)
- `module_id` (FK → modules)
- `price_paid` (numeric)
- `yandex_pay_id` (text)
- `purchased_at` (timestamptz)

### Прогресс и геймификация

**lesson_progress**
- `id` (uuid, PK)
- `user_id` (FK → profiles)
- `lesson_id` (FK → lessons)
- `status` (enum: not_started | in_progress | done)
- `completed_at` (timestamptz, nullable)
- `updated_at` (timestamptz)

**task_attempts**
- `id` (uuid, PK)
- `user_id` (FK → profiles)
- `task_id` (FK → tasks)
- `answer` (jsonb)
- `is_correct` (boolean)
- `points_earned` (int)
- `attempted_at` (timestamptz)

**achievements**
- `id` (uuid, PK)
- `slug` (text, unique)
- `title` (text)
- `description` (text)
- `icon_url` (text)
- `condition` (jsonb)
- `points` (int)

**user_achievements**
- `id` (uuid, PK)
- `user_id` (FK → profiles)
- `achievement_id` (FK → achievements)
- `earned_at` (timestamptz)

**streaks**
- `id` (uuid, PK)
- `user_id` (FK → profiles, unique)
- `current_streak` (int)
- `longest_streak` (int)
- `last_activity_date` (date)
- `updated_at` (timestamptz)

---

## 5. Страницы

### Публичная часть (SSG, SEO)

| Путь | Описание |
|------|----------|
| `/` | Лендинг: что это, для кого, тарифы, CTA |
| `/modules` | Каталог модулей (карточки с обложками) |
| `/modules/[slug]` | Превью модуля: описание, список уроков |
| `/modules/[slug]/[lesson]` | Превью урока: первые 2-3 блока за blur |

### Авторизация

| Путь | Описание |
|------|----------|
| `/login` | Вход по email + пароль |
| `/register` | Регистрация + поле промокода |
| `/forgot-password` | Восстановление пароля |

### Личный кабинет (auth required)

| Путь | Описание |
|------|----------|
| `/dashboard` | Прогресс, streak, баллы, достижения |
| `/learn/[slug]` | Прохождение модуля |
| `/learn/[slug]/[lesson]` | Урок: контент + задачи inline |
| `/profile` | Настройки, управление подпиской |
| `/achievements` | Все достижения |
| `/leaderboard` | Рейтинг учеников |

### Оплата

| Путь | Описание |
|------|----------|
| `/pricing` | Тарифы и premium-модули |
| `/checkout/subscription` | Оплата подписки (ЯндексPay) |
| `/checkout/module/[id]` | Покупка premium-модуля |

### Админ-панель

| Путь | Описание |
|------|----------|
| `/admin` | Дашборд: ученики, подписки, выручка |
| `/admin/modules` | CRUD модулей, drag-n-drop сортировка |
| `/admin/modules/[id]` | Редактор модуля + уроки |
| `/admin/modules/[id]/[lesson]` | Визуальный block-based редактор урока |
| `/admin/promo` | Генерация и управление промокодами |
| `/admin/users` | Список учеников |
| `/admin/achievements` | Управление достижениями |

---

## 6. Оплата и доступ

### Логика доступа

```
canAccessLesson(user, lesson):
  module = lesson.module
  if module.tier == "base":
    return user.subscription.status == "active"
  if module.tier == "premium":
    return module_purchases.exists(user, module)
  return false
```

### ЯндексPay флоу

**Подписка:**
1. Пользователь выбирает тариф → POST `/api/payments/create`
2. Редирект на ЯндексPay
3. Успешная оплата → webhook POST `/api/payments/webhook`
4. Webhook обновляет `subscriptions` (status=active)
5. Автопродление ежемесячно

**Покупка модуля:**
1. Кнопка "Купить" → POST `/api/payments/create-module`
2. ЯндексPay → webhook → `module_purchases.insert`
3. Разовый платёж, без автопродления

### Промокоды

- Формат: `XIMI-XXXX-XXXX`
- Генерация пачками в админке
- Экспорт в CSV для печати
- Одноразовые, привязываются к user при активации
- Результат: plan=base_promo (499₽/мес), первый платёж через 30 дней

---

## 7. Геймификация

### Баллы (XP)

| Действие | XP |
|----------|----|
| Правильный ответ (1-я попытка) | task.points × 1.0 |
| Правильный ответ (2-я попытка) | task.points × 0.5 |
| Правильный ответ (3+ попытка) | task.points × 0.25 |
| Завершение урока | +20 XP |
| Завершение модуля | +100 XP |
| Streak бонус (ежедневно) | +5 XP × current_streak |

Сложность → базовые баллы: 10 / 20 / 35 / 50 / 75 XP

### Streaks

- +1 за каждый день с решённой задачей
- Сброс при пропуске дня
- Обновляется при `task_attempt`

### Достижения (MVP)

| Бейдж | Условие |
|-------|---------|
| Первая реакция | Решить первую задачу |
| Лаборант | Решить 50 задач |
| Химик | Решить 200 задач |
| Профессор | Решить 500 задач |
| Неделя огня | Streak 7 дней |
| Месяц в лаборатории | Streak 30 дней |
| Без ошибок | Модуль со 100% с 1-й попытки |
| Первый модуль | Завершить любой модуль |
| Всезнайка | Завершить все base-модули |

Проверка при событии (task_attempt, lesson_complete) — мгновенная обратная связь.

### Рейтинг

- Топ-50 по XP: неделя / месяц / всё время
- Materialized view, обновление раз в час
- Своя позиция видна всегда

---

## 8. Админ-панель и редактор

### Block-based редактор (Tiptap)

Типы блоков:
- **text** — Rich-text (bold, italic, списки, заголовки), JSON output
- **formula** — LaTeX ввод + live-превью через KaTeX, шаблоны `\ce{}`, `\frac{}`
- **image** — Drag-n-drop upload в Supabase Storage, подпись + alt
- **task** — Конструктор: тип, варианты, правильный ответ, пояснение, сложность
- **video** — YouTube embed URL (на будущее)

Функции:
- Drag-n-drop сортировка блоков (@dnd-kit)
- Черновик / Публикация (`is_published`)
- Превью урока

### Управление промокодами

- Генерация пачками (100-500 шт)
- Таблица: код, статус, использован кем, дата
- Экспорт CSV
