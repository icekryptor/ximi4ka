# Content MCP-сервер Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans / Workflow.

**Goal:** MCP-сервер поверх контент-движка, co-hosted в backend Railway, чтобы агенты Planner/Writer в Claude Desktop Cowork читали контекст из БД и писали результат обратно. Транспорт remote HTTP, токен-гейт. Обновить мини-инструкцию Cowork в харнессе.

**Architecture:** `@modelcontextprotocol/sdk` StreamableHTTP на `POST/GET/DELETE /mcp`, смонтирован в Express ДО express.json (транспорт сам парсит тело). Токен `MCP_ACCESS_TOKEN`. Read/write инструменты переиспользуют логику content-engine/content-plan контроллеров через общий `content-context.service.ts`.

**Design:** `docs/plans/2026-07-04-content-mcp-design.md`

**Testing:** typecheck + локальный MCP-хендшейк (initialize/tools/list/tools/call) + токен-гейт + прод-smoke.

---

## Task 1: Общий сервис контекста (DRY-рефактор)

**Files:**
- Create: `backend/src/services/content-context.service.ts`
- Refactor (не ломая API): `backend/src/controllers/content-engine.controller.ts` (blueprint переиспользует сервис, где уместно)

**Суть:** вынести чистые сборщики (без Request/Response), которые вернут данные и для blueprint-эндпоинта, и для MCP:
```typescript
// возвращают простые объекты/строки, читают через AppDataSource + prompt-cache/recipeEngine
export async function getPlannerContext(): Promise<{
  funnel: string; segments: Array<{slug,name,role,age_range,description}>;
  strategySummary: string; plan: { markdown: string; items: ContentPlanItem[] };
  brief: string;  // собранный текстовый бриф (как planner promptPreview)
}>
export async function getWriterContext(opts: { segmentSlug?: string; rubricSlug?: string }): Promise<{
  styleGuideText, styleGuideVideo, rubricsMatrix, strategyPhase, planMarkdown,
  segment: {slug,name,description}|null; brief: string;
}>
export async function listPlanItems(): Promise<ContentPlanItem[]>
export async function listSegments(): Promise<Array<{slug,name,role,age_range}>>
export async function listRubrics(): Promise<Array<{slug,title}>>
// write:
export async function saveContentPlan(markdown: string): Promise<void>  // upsert brand_doc content_plan_current
export async function addPlanItem(input): Promise<ContentPlanItem>       // резолв segment_slug/theme_slug → id
export async function updatePlanItem(id, patch): Promise<ContentPlanItem|null>
export async function deletePlanItem(id): Promise<boolean>
```
Сегменты: сущность `IcpSegment` (поля slug/name/role/age_range/description/active — сверить в entity). Рубрики: `ContentRubric` (slug/title — сверить). Стратегия-выжимка: `extractStrategySummary` из prompt-cache (уже есть). Воронка: brand_doc funnel_levels.

Typecheck. Commit: `refactor(content-engine): content-context.service — общие сборщики для blueprint и MCP`

## Task 2: MCP-сервер

**Files:**
- Install: `cd backend && npm i @modelcontextprotocol/sdk zod`
- Create: `backend/src/mcp/content-mcp.server.ts`
- Modify: `backend/src/server.ts` (смонтировать ДО express.json)

**content-mcp.server.ts:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import * as ctx from '../services/content-context.service'

// Фабрика: новый McpServer с зарегистрированными tools
export function buildContentMcpServer(): McpServer {
  const server = new McpServer({ name: 'ximi-content-engine', version: '1.0.0' })

  server.tool('planner_context', 'Полный контекст для агента-планировщика: воронка TOFU/MOFU/BOFU, активные ICP-сегменты, выжимка маркетинг-стратегии, текущий контент-план. Вызови ПЕРЕД составлением плана.', {}, async () => {
    const c = await ctx.getPlannerContext()
    return { content: [{ type: 'text', text: c.brief }] }
  })

  server.tool('writer_context', 'Контекст для копирайтера: стиль-гайды, матрица рубрик, фаза стратегии, контент-план, деталь сегмента. Передай segment_slug и rubric_slug для адресности.', {
    segment_slug: z.string().optional().describe('slug ICP-сегмента (см. list_segments)'),
    rubric_slug: z.string().optional().describe('slug рубрики (см. list_rubrics)'),
  }, async ({ segment_slug, rubric_slug }) => {
    const c = await ctx.getWriterContext({ segmentSlug: segment_slug, rubricSlug: rubric_slug })
    return { content: [{ type: 'text', text: c.brief }] }
  })

  server.tool('list_plan_items', 'Строки текущего контент-плана (дата, воронка, сегмент, тема, формат, цель, статус).', {}, async () => {
    const items = await ctx.listPlanItems()
    return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
  })

  server.tool('list_segments', 'Справочник ICP-сегментов (slug + название). Используй slug при записи плана.', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(await ctx.listSegments(), null, 2) }] }
  })
  server.tool('list_rubrics', 'Справочник рубрик (slug + название).', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(await ctx.listRubrics(), null, 2) }] }
  })

  server.tool('save_content_plan', 'Сохранить/перезаписать контент-план (markdown) в БД. Planner вызывает после составления плана.', {
    markdown: z.string().describe('полный markdown контент-плана'),
  }, async ({ markdown }) => {
    await ctx.saveContentPlan(markdown)
    return { content: [{ type: 'text', text: 'Контент-план сохранён в content_plan_current.' }] }
  })

  server.tool('add_plan_item', 'Добавить строку в индекс контент-плана.', {
    funnel_level: z.enum(['TOFU','MOFU','BOFU']).describe('уровень воронки'),
    format: z.string().describe('формат/content_type (напр. short_post)'),
    goal: z.string().describe('цель пункта'),
    plan_date: z.string().optional().describe('дата YYYY-MM-DD'),
    segment_slug: z.string().optional(),
    theme_slug: z.string().optional(),
    status: z.enum(['planned','in_progress','published']).optional(),
  }, async (input) => {
    const item = await ctx.addPlanItem(input)  // сервис резолвит slug→id, ошибка со списком валидных при промахе
    return { content: [{ type: 'text', text: `Добавлено: ${item.id}` }] }
  })
  server.tool('update_plan_item', 'Обновить строку плана по id.', {
    id: z.string(), status: z.enum(['planned','in_progress','published']).optional(),
    goal: z.string().optional(), plan_date: z.string().optional(),
    funnel_level: z.enum(['TOFU','MOFU','BOFU']).optional(),
  }, async ({ id, ...patch }) => {
    const upd = await ctx.updatePlanItem(id, patch)
    return { content: [{ type: 'text', text: upd ? 'Обновлено' : 'Строка не найдена' }], isError: !upd }
  })
  server.tool('delete_plan_item', 'Удалить строку плана по id.', { id: z.string() }, async ({ id }) => {
    const ok = await ctx.deletePlanItem(id)
    return { content: [{ type: 'text', text: ok ? 'Удалено' : 'Строка не найдена' }], isError: !ok }
  })

  return server
}

// Express-хендлер: токен-гейт + StreamableHTTP (stateless: новый server+transport на запрос)
export async function handleMcpRequest(req, res) {
  const token = process.env.MCP_ACCESS_TOKEN
  if (!token) { res.status(503).json({ error: 'MCP не настроен (MCP_ACCESS_TOKEN)' }); return }
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${token}`) { res.status(401).json({ error: 'unauthorized' }); return }
  const server = buildContentMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })  // stateless
  res.on('close', () => { transport.close(); server.close() })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
}
```
(Сверить точный API SDK при установке — сигнатуры `server.tool`, StreamableHTTP stateless-режим. Если stateless-режим требует body-parser — смонтировать express.json ТОЛЬКО для /mcp перед хендлером; иначе транспорт читает поток. Проверить в доке SDK через context7.)

**server.ts:** до `app.use(express.json(...))` (или с отдельным express.json для /mcp):
```typescript
import { handleMcpRequest } from './mcp/content-mcp.server'
app.post('/mcp', express.json({ limit: '4mb' }), handleMcpRequest)
app.get('/mcp', handleMcpRequest)
app.delete('/mcp', handleMcpRequest)
```
try/catch вокруг импорта/маунта, чтобы падение MCP не роняло бэкенд.

Typecheck. Commit: `feat(content-mcp): MCP-сервер (StreamableHTTP) — planner/writer context + content-plan tools`

## Task 3: Frontend — обновить мини-инструкцию Cowork

**Files:**
- Modify: `frontend/src/components/content-engine/CoworkGuide.tsx` (или где сейчас гайд)

Переписать шаги под MCP:
1. Подключить connector в Claude Desktop → Settings → Connectors → Add: URL `https://ximi4kafinance-production.up.railway.app/mcp`, тип «HTTP», токен в заголовке Authorization `Bearer <MCP_ACCESS_TOKEN>`.
2. Planner-сессия: агент вызывает `planner_context` → составляет план → `save_content_plan` + `add_plan_item`.
3. Writer-сессия: `writer_context(segment_slug, rubric_slug)` → пишет пост.
4. Список инструментов (planner_context / writer_context / list_* / save_content_plan / *_plan_item).
Пометка: файлы-знания больше не нужны, данные из БД.

Typecheck. Commit: `feat(content-mcp): харнесс — инструкция подключения MCP-коннектора вместо файлов`

## Task 4: E2E + деплой

1. Backend build; локально `POST /mcp` с телом `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}` + header `Authorization: Bearer <token>` (задать MCP_ACCESS_TOKEN в backend/.env локально) → capabilities. `tools/list` → 9 инструментов. `tools/call planner_context` → бриф. `tools/call add_plan_item` → строка в БД (потом удалить). Проверить 401 без токена, 503 без env.
2. Установить `MCP_ACCESS_TOKEN` в Railway (через API, как делали с WB_RELAY_TOKEN). push origin.
3. Прод-smoke те же вызовы на `/mcp`.
4. Выдать пользователю: URL коннектора + токен + шаги подключения в Claude Desktop.

## Reference
- Дизайн: `docs/plans/2026-07-04-content-mcp-design.md`
- Образцы: `content-plan.controller.ts` (write-логика), `prompt-cache.ts` (extractStrategySummary), `apiKeyAuth.ts` (токен-гейт), `content-engine.controller.ts` (сборка контекста)
- context7 для актуального API @modelcontextprotocol/sdk (StreamableHTTP stateless mount в Express)
