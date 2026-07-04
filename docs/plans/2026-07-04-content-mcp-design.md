# Content-движок MCP-сервер (Cowork ↔ БД) — Design

**Date:** 2026-07-04
**Scope:** MCP-сервер поверх контент-движка, чтобы агенты Planner/Writer в Claude Desktop Cowork читали живой контекст из БД и писали результаты обратно — без копирования файлов-знаний. Транспорт — remote HTTP, клиент — Claude Desktop (Max). Обновить мини-инструкцию Cowork в харнессе под MCP.

## Goal

Сейчас, чтобы агент в Cowork имел контекст (стиль-гайды, стратегия, план, сегменты), оператор копирует их файлами. Данные устаревают, ручная возня. Нужно: агент через MCP-connector дёргает свежие данные из БД ERP и туда же пишет план/результат. Ноль копипаста, всегда актуально.

## Решение: MCP-сервер, co-hosted в backend Railway

Бэкенд уже публичный HTTPS на Railway. Встраиваем MCP как StreamableHTTP-эндпоинт `/mcp` в тот же Express-процесс, переиспользуя `AppDataSource` + entities + логику существующих контроллеров. Отдельный сервис не нужен. Claude Desktop подключает его как remote MCP connector с bearer-токеном.

Отвергнуто: (а) отдельный MCP-микросервис — лишний деплой, дублирование доступа к БД; (б) stdio-транспорт — не работает для Claude Desktop remote/Cowork, нужен HTTP; (в) оставить копипаст — то, от чего уходим.

## Транспорт и аутентификация

- `@modelcontextprotocol/sdk` (Node), `StreamableHTTPServerTransport`, смонтирован в Express на `POST /mcp` (и `GET /mcp` для SSE-стрима, `DELETE /mcp` для закрытия сессии).
- Токен: env `MCP_ACCESS_TOKEN`. Проверка `Authorization: Bearer <token>` на входе в `/mcp` (middleware до передачи транспорту). Нет токена в env → эндпоинт отдаёт 503 с понятным логом.
- Ставится ДО express.json для /mcp (StreamableHTTP сам парсит тело) — смонтировать раздельно.

## Инструменты (tools)

**Чтение:**
- `planner_context()` → всё для Planner одним вызовом: воронка (funnel_levels), активные ICP-сегменты (name/role/age/описание), выжимка стратегии (TL;DR + фаза), текущий контент-план (markdown + строки-индекс). Возвращает структурированный JSON + собранный текстовый бриф.
- `writer_context({ segment_slug?, rubric_slug? })` → всё для Writer: style_guide_text, style_guide_video, rubrics_matrix, фаза стратегии, content_plan_current, деталь выбранного сегмента (если задан). Собранный бриф + сырые доки.
- `list_plan_items()` → строки content_plan_item (дата, воронка, сегмент, тема, формат, цель, статус).
- `list_segments()` / `list_rubrics()` → справочники (slug + название), чтобы агент знал допустимые значения при записи.

**Запись:**
- `save_content_plan({ markdown })` → upsert brand_doc `content_plan_current` (Planner сохраняет план).
- `add_plan_item({ plan_date?, funnel_level, segment_slug?, theme_slug?, format, goal, status? })` → вставка строки-индекса (slug'и резолвятся в id).
- `update_plan_item({ id, ...fields })` / `delete_plan_item({ id })`.

Дизайн-принципы MCP (из mcp-builder): говорящие имена, подробные описания с примерами значений (`funnel_level: TOFU|MOFU|BOFU`), валидация входа (zod-схемы), человекочитаемые ошибки, идемпотентность записи где возможно.

## Логика (переиспользование)

Read-инструменты используют уже существующую сборку из `content-engine.controller.blueprint` / `prompt-cache` (воронка+сегменты+стратегия) и `content-plan.controller` (план). Вынести общие сборщики в сервис `content-context.service.ts`, чтобы и blueprint-эндпоинт, и MCP звали одно и то же (DRY). Write — через ту же логику, что content-plan.controller (upsert brand_doc + CRUD item).

## Frontend — обновить харнесс

Мини-инструкция «Как работать с агентами через Cowork» переписывается: вместо «скопируй доки файлами» → «подключи MCP-connector (URL + токен), агент сам читает контекст и пишет результат». Показать: URL `/mcp`, где взять токен, список доступных инструментов (planner_context / writer_context / save_content_plan…). Planner-панель: пометка «данные тянутся из БД через MCP».

## Failure handling

| Ситуация | Поведение |
|---|---|
| `MCP_ACCESS_TOKEN` не задан | `/mcp` → 503 «MCP не настроен», лог; остальной API работает |
| Неверный токен | 401 |
| Запись с несуществующим segment_slug | инструмент возвращает ошибку со списком валидных slug'ов |
| brand_doc пуст (план/гайд) | read-инструмент отдаёт пустую строку + пометку «не задан» |
| MCP SDK падает при инициализации | try/catch вокруг mount, лог, бэкенд стартует без /mcp |

## Testing

Typecheck. Локальный smoke: `POST /mcp` с `initialize` → capabilities; `tools/list` → все инструменты; `tools/call planner_context` → бриф с воронкой+сегментами; `tools/call add_plan_item` → строка в БД; `tools/call save_content_plan` → brand_doc обновлён. Проверить токен-гейт (401 без токена). Прод-smoke те же вызовы. Инструкция подключения connector'а в Claude Desktop — выдать пользователю (URL + токен).

## v2 / волна 2

- `save_style_pattern` / `get_style_learned` — цикл самообучения Writer'а
- `create_content_unit` — Writer пишет готовый пост прямо в контент-банк
- Per-user токены (сейчас один общий MCP_ACCESS_TOKEN)
