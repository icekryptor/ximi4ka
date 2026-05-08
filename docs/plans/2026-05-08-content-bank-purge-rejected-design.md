# Контент-банк — Purge Rejected (micro)

**Date:** 2026-05-08
**Builds on:** 2026-05-08-content-bank-v2 (just deployed; `review_grade='rejected'` already in schema and CHECK constraint).

## Goal

Кнопка-бейдж «🗑 Отказы (N)» в шапке `/content-bank`, параллельная «Триаж (N)». Клик → confirm → массовое удаление всех `review_grade='rejected'` единиц (publications уйдут через FK CASCADE).

## Decisions

- UI: option **A** — header badge button, скрывается при N=0, danger styling (красный border+text)
- Backend: 2 новых эндпоинта (`rejected-count` + `purge-rejected`), параллельные существующим v2-методам
- Schema: без изменений (v2 уже добавил `review_grade`)
- Deploy: push в оба remote'а, без миграции

## Backend

`backend/src/controllers/content-unit.controller.ts` — 2 новых метода рядом с `ungradedCount`:

```ts
async rejectedCount(req: Request, res: Response) {
  try {
    const count = await repo.count({ where: { review_grade: 'rejected' } })
    res.json({ count })
  } catch (e) {
    console.error('Error counting rejected units:', e)
    res.status(500).json({ error: 'Ошибка подсчёта отказов' })
  }
},

async purgeRejected(req: Request, res: Response) {
  try {
    const result = await repo.delete({ review_grade: 'rejected' })
    res.json({ deleted: result.affected || 0 })
  } catch (e) {
    console.error('Error purging rejected units:', e)
    res.status(500).json({ error: 'Ошибка удаления отказов' })
  }
},
```

Routes (перед `/:id`):
```ts
router.get('/rejected-count', contentUnitController.rejectedCount)
router.delete('/purge-rejected', contentUnitController.purgeRejected)
```

Каскад на `content_publications` уже обеспечен `ON DELETE CASCADE` FK из v1-миграции.

## Frontend

`frontend/src/api/contentBank.ts` — 2 новых метода в `unitsApi`:

```ts
rejectedCount: async (): Promise<{ count: number }> => {
  const r = await apiClient.get<{ count: number }>('/content-units/rejected-count')
  return r.data
},

purgeRejected: async (): Promise<{ deleted: number }> => {
  const r = await apiClient.delete<{ deleted: number }>('/content-units/purge-rejected')
  return r.data
},
```

`frontend/src/pages/ContentBank.tsx`:
- Новый state `[rejectedCount, setRejectedCount] = useState(0)`
- `loadRejectedCount` callback (по образцу `loadUngradedCount`)
- Вызывается на mount + после import + после triage save (последнее достигается через onClose триажа, который уже зовёт `load()` — нужно дополнить)
- Новая кнопка в шапке между «Триаж» и «Импорт», visible only when `rejectedCount > 0`:

```tsx
{rejectedCount > 0 && (
  <button
    onClick={handlePurgeRejected}
    className="btn flex items-center gap-2 border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
    title="Удалить все идеи со статусом «отказ»"
  >
    <Trash2 size={16} />
    <span className="hidden sm:inline">Отказы ({rejectedCount})</span>
  </button>
)}
```

- Handler через `useConfirmDialog`:
```ts
const handlePurgeRejected = async () => {
  const ok = await confirm({
    title: 'Удалить отказные идеи?',
    message: `Будет удалено ${rejectedCount} идей со статусом «❌ отказ» вместе с их публикациями. Действие нельзя отменить.`,
    confirmText: 'Удалить',
    variant: 'danger',
  })
  if (!ok) return
  try {
    const r = await unitsApi.purgeRejected()
    toast.success(`Удалено ${r.deleted} идей`)
    await Promise.all([load(), loadUngradedCount(), loadRejectedCount()])
  } catch {
    toast.error('Ошибка удаления отказов')
  }
}
```

`Trash2` уже импортирован в `ContentBank.tsx` (используется в действиях строки таблицы).

## Files

| Файл | Что |
|---|---|
| `backend/src/controllers/content-unit.controller.ts` | +2 метода |
| `backend/src/routes/content-unit.routes.ts` | +2 роута |
| `frontend/src/api/contentBank.ts` | +2 API-метода |
| `frontend/src/pages/ContentBank.tsx` | state + callback + button + handler |

## Rollout

- Без миграции
- Merge → push в `origin` + `vercel-deploy`
- Smoke: триажнуть 2-3 идеи как rejected → кнопка «Отказы (3)» появилась → клик → confirm → удалено → кнопка пропала, count в фильтре «❌ отказ» = 0

Out of scope: bulk-purge для других статусов, undo, восстановление из backup.
