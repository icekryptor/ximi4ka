# Carousel Body Text + «Написать сценарий» Button — Design

**Date:** 2026-05-13
**Scope:** Add proper text fields to `carousel` content_type (caption + slides) and a
«Написать сценарий» button that copies a fully-assembled prompt to clipboard and
opens Claude (claude.ai / Claude Desktop) for script generation against the org's
marketing strategy + carousel style guide + rubric tone.

## Goal

Сейчас `content_type === 'carousel'` падает в дефолтную ветку `renderTypeFields()`
в `UnitEditModal.tsx` — показывает поля `hook / hook_ab / visual / essence / notes`,
ни одно из которых не моделирует «карусель = подпись поста + N слайдов». Оператор
не может ни записать подпись, ни описать слайды.

Параллельно нужна кнопка, которая по контексту юнита, рубрики и маркетинг-стратегии
собирает промпт и отдаёт в Claude (через буфер обмена, без обращения к Anthropic API
— чтобы не зависеть от баланса кредитов).

## Non-goals (YAGNI)

- Не строим recipe-движок для carousel (видим Phase C plan — отдельный PR в будущем,
  после реальной обкатки). Сейчас — точечная ветка в `renderTypeFields()`.
- Не вставляем промпт в Claude автоматически через `?q=` URL-параметр (длина
  промпта 5–10 КБ упрётся в URL-лимиты).
- Не отслеживаем, что Claude ответил. Оператор копипастит финал обратно сам.
- Не пишем автотесты — в проекте нет тестового фундамента, smoke-чеклист
  достаточен для этой фичи.
- Не делаем drag-and-drop слайдов. `@dnd-kit` в репе уже ломает typecheck;
  стрелки ⬆⬇ покрывают MVP.

## Architecture

### Data model

Миграция: две nullable-колонки на `content_units`.

```sql
ALTER TABLE content_units
  ADD COLUMN body_caption text,
  ADD COLUMN slides       jsonb;
```

Семантика `slides`: массив `{text: string, visual: string}`.

Почему `jsonb`, не отдельная таблица:
- слайды не запрашиваются отдельно от юнита,
- порядок естественно хранится массивом,
- не нужно фильтровать/индексировать по содержимому,
- удалять/переставлять = ре-сериализация на фронте.

Существующие `hook / hook_ab / visual / essence / notes` остаются — для legacy
юнитов и других типов. Для `carousel` они скрываются в UI, но в БД не дропаются.

### Backend endpoint

```
POST /api/content-units/:id/script-prompt
→ 200 { prompt: string }
→ 400 { error: 'Сценарий пока доступен только для каруселей' } если content_type !== 'carousel'
→ 404 { error: 'Юнит не найден' }
→ 500 { error: 'Не удалось собрать промпт' } + verbose stack в log
```

Pure string assembly, no side effects.

Источники для промпта:
- `BrandDoc[slug='strategy_current']` → north star
- `BrandDoc[slug='style_guide_carousel']` → гайдлайн карусели
- `ContentRubric` юнита → `tone / audience / cta_template`
- сам `ContentUnit`: `title / hook / essence / body_caption / slides`

Авто-сид BrandDoc'а: если `style_guide_carousel` отсутствует — создаётся пустой
stub с заголовком «Гайдлайн карусели», чтобы пользователь увидел его в UI
редактора BrandDoc'ов. Промпт всё равно собирается, секция гайдлайна просто пустая.

Кэш BrandDoc'ов — переиспользуем существующий механизм `ctx.cache.brandDocs`
из `voiceover.controller.ts` / `claude.controller.ts`.

### Prompt template

```
[NORTH STAR — МАРКЕТИНГ-СТРАТЕГИЯ]
{strategy_current.content}

[ГАЙДЛАЙН ПО КАРУСЕЛЯМ]
{style_guide_carousel.content}

[РУБРИКА: {rubric.title}]
Tone: {rubric.tone}
Audience: {rubric.audience}
CTA: {rubric.cta_template}

[ЗАДАЧА]
Тип: карусель
Название: {unit.title}
Hook: {unit.hook}
Суть: {unit.essence}

Подпись (draft): {unit.body_caption || '<пусто>'}
Слайды (draft):
  1. text: {slide.text || '<пусто>'}
     visual: {slide.visual || '<пусто>'}
  2. ...

[ЧТО НУЖНО]
Напиши финальную версию: подпись поста и текст каждого слайда.
Соблюдай гайдлайн и тон рубрики. Опирайся на маркетинг-стратегию как на north star.
Для каждого слайда дай: (а) короткий текст на самом слайде, (б) визуальную идею.
```

Отсутствующие источники (рубрика не выбрана, гайдлайн пуст) → секция опускается,
а не пишется `null`.

### Frontend — форма карусели

Новая ветка в `UnitEditModal.renderTypeFields()`:

```tsx
if (formData.content_type === 'carousel') {
  return (
    <>
      <CaptionField />     {/* textarea + кнопка «Написать сценарий» */}
      <SlideList />        {/* список слайдов с +/− и стрелками ⬆⬇ */}
      <NotesField />
    </>
  )
}
```

Скрываются `hook / hook_ab / visual / essence`. Остаются общие `title / status /
complexity / ready_at / publications`.

`<SlideList>` — локальный компонент внутри `UnitEditModal.tsx` (без отдельного
файла; YAGNI). Каждый слайд: номер + ⬆⬇ + ✕ + два textarea (`text`, `visual`).

Состояние слайдов — `formData.slides: CarouselSlide[]`. При сохранении пустые
слайды (text=='' && visual=='') отфильтровываются на бэке.

### Frontend — кнопка «Написать сценарий»

Расположение: справа над textarea подписи. `<button>` + `<Sparkles size={14}/>`,
подпись «Написать сценарий».

Disabled когда:
- юнит ещё не сохранён (`unit === 'new'` и нет `unitInternal`),
- `saving === true`.

Поведение по клику:

```
1. Если есть несохранённые изменения формы → автосейв через handleSave.
2. POST /api/content-units/{id}/script-prompt → { prompt }
3. navigator.clipboard.writeText(prompt)
4. window.open('https://claude.ai/new', '_blank', 'noopener,noreferrer')
5. toast.success('Промпт скопирован — вставь в Claude (Cmd/Ctrl+V)')
```

Авто-сейв перед запросом устраняет рассинхрон между UI-состоянием формы и тем,
что улетает в промпт.

## Error handling

| Кейс | Что показываем | Дальше |
|---|---|---|
| autosave 4xx/5xx | toast.error (сообщение бэка или «Не удалось сохранить юнит») | abort |
| `/script-prompt` 400 | toast.error('Сценарий пока доступен только для каруселей') | abort |
| `/script-prompt` 404 | toast.error('Юнит не найден') | abort |
| `/script-prompt` 500 | toast.error('Не удалось собрать промпт'); stack в Railway logs | abort |
| `clipboard.writeText` отказал | fallback-модалка с промптом в `<pre>` и ручной кнопкой «Скопировать» | continue → open Claude |
| `window.open` заблокирован | toast.info('Промпт в буфере. Открой claude.ai и вставь.') | промпт уже в буфере |

## Testing — smoke checklist

1. Миграция накатилась, старые юниты грузятся (`body_caption=null, slides=null`).
2. Создание карусели — форма показывает caption + слайды + notes.
3. Слайды: +/⬆⬇/✕, сохраняется и поднимается порядок.
4. Пустые слайды фильтруются на бэке.
5. Смена `content_type` туда-обратно не теряет сохранённые caption/slides.
6. Кнопка «Написать сценарий»:
   - disabled на несохранённом юните,
   - на сохранённом — буфер содержит промпт, открыт `claude.ai/new`, тост.
   - с unsaved-изменениями — автосейвится перед сборкой промпта.
7. Промпт содержит блоки north star / гайдлайна / рубрики / задачи.
8. Авто-сид: `style_guide_carousel` создан после первого клика.
9. Non-carousel юнит → 400 + тост.
10. Кросс-браузер на проде (HTTPS) — clipboard работает.

Автотесты не пишем (нет фундамента; YAGNI).

## Open questions / future

- После 2–3 реальных каруселей решаем — переезжать ли на recipe-движок (Phase C
  plan), есть ли смысл в drag-and-drop слайдов, нужны ли роли (cover/content/cta).
- Возможно стоит добавить «Заполнить из буфера» — кнопку, которая парсит ответ
  Claude обратно в форму. Но это требует стабильного формата ответа, а пока
  Claude отдаёт свободный текст — оставляем ручной копипаст.
