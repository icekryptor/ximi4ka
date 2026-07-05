import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { Request, Response } from 'express';
import * as ctx from '../services/content-context.service';

// MCP-сервер контент-движка (StreamableHTTP, stateless). На каждый запрос
// создаётся новый McpServer + transport. Токен-гейт: MCP_ACCESS_TOKEN.

/** Обёртка write-инструмента: ловит ошибки сервиса (напр. неверный slug)
 *  и возвращает их как isError-контент, чтобы агент увидел текст ошибки. */
async function safeTool(
  fn: () => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Ошибка: ${message}` }], isError: true };
  }
}

/** Фабрика: новый McpServer с зарегистрированными инструментами. */
export function buildContentMcpServer(): McpServer {
  const server = new McpServer({ name: 'ximi-content-engine', version: '1.0.0' });

  server.registerTool(
    'planner_context',
    {
      description:
        'Полный контекст для агента-планировщика: воронка TOFU/MOFU/BOFU, активные ICP-сегменты, выжимка маркетинг-стратегии, текущий контент-план. Вызови ПЕРЕД составлением плана.',
    },
    async () => {
      const c = await ctx.getPlannerContext();
      return { content: [{ type: 'text', text: c.brief }] };
    },
  );

  server.registerTool(
    'writer_context',
    {
      description:
        'Контекст для копирайтера: стиль-гайды, матрица рубрик, фаза стратегии, контент-план, деталь сегмента. Передай segment_slug и rubric_slug для адресности.',
      inputSchema: {
        segment_slug: z.string().optional().describe('slug ICP-сегмента (см. list_segments)'),
        rubric_slug: z.string().optional().describe('slug рубрики (см. list_rubrics)'),
      },
    },
    async ({ segment_slug, rubric_slug }) => {
      const c = await ctx.getWriterContext({
        segmentSlug: segment_slug,
        rubricSlug: rubric_slug,
      });
      return { content: [{ type: 'text', text: c.brief }] };
    },
  );

  server.registerTool(
    'list_plan_items',
    {
      description:
        'Строки текущего контент-плана (id, дата, воронка, сегмент, тема, формат, цель, статус).',
    },
    async () => {
      const items = await ctx.listPlanItems();
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    },
  );

  server.registerTool(
    'list_segments',
    {
      description:
        'Справочник ICP-сегментов (slug + название + роль/возраст). Используй slug при записи плана.',
    },
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify(await ctx.listSegments(), null, 2) }] };
    },
  );

  server.registerTool(
    'list_rubrics',
    { description: 'Справочник рубрик (slug + название).' },
    async () => {
      return { content: [{ type: 'text', text: JSON.stringify(await ctx.listRubrics(), null, 2) }] };
    },
  );

  server.registerTool(
    'save_content_plan',
    {
      description:
        'Сохранить/перезаписать контент-план (markdown) в БД. Planner вызывает после составления плана.',
      inputSchema: {
        markdown: z.string().describe('полный markdown контент-плана'),
      },
    },
    async ({ markdown }) => {
      await ctx.saveContentPlan(markdown);
      return { content: [{ type: 'text', text: 'Контент-план сохранён в content_plan_current.' }] };
    },
  );

  server.registerTool(
    'add_plan_item',
    {
      description: 'Добавить строку в индекс контент-плана. Резолвит segment_slug/theme_slug → id.',
      inputSchema: {
        funnel_level: z.enum(['TOFU', 'MOFU', 'BOFU']).describe('уровень воронки'),
        format: z.string().describe('формат/content_type (напр. short_post)'),
        goal: z.string().describe('цель пункта'),
        plan_date: z.string().optional().describe('дата YYYY-MM-DD'),
        segment_slug: z.string().optional().describe('slug сегмента (см. list_segments)'),
        theme_slug: z.string().optional().describe('slug стратегической темы'),
        status: z.enum(['planned', 'in_progress', 'published']).optional(),
      },
    },
    async (input) =>
      safeTool(async () => {
        const item = await ctx.addPlanItem(input);
        return { content: [{ type: 'text', text: `Добавлено: ${item.id}` }] };
      }),
  );

  server.registerTool(
    'update_plan_item',
    {
      description: 'Обновить строку плана по id.',
      inputSchema: {
        id: z.string().describe('id строки плана'),
        status: z.enum(['planned', 'in_progress', 'published']).optional(),
        goal: z.string().optional(),
        plan_date: z.string().optional(),
        funnel_level: z.enum(['TOFU', 'MOFU', 'BOFU']).optional(),
      },
    },
    async ({ id, ...patch }) =>
      safeTool(async () => {
        const upd = await ctx.updatePlanItem(id, patch);
        return {
          content: [{ type: 'text', text: upd ? 'Обновлено' : 'Строка не найдена' }],
          isError: !upd,
        };
      }),
  );

  server.registerTool(
    'delete_plan_item',
    {
      description: 'Удалить строку плана по id.',
      inputSchema: { id: z.string().describe('id строки плана') },
    },
    async ({ id }) =>
      safeTool(async () => {
        const ok = await ctx.deletePlanItem(id);
        return {
          content: [{ type: 'text', text: ok ? 'Удалено' : 'Строка не найдена' }],
          isError: !ok,
        };
      }),
  );

  return server;
}

/** Express-хендлер: токен-гейт + StreamableHTTP (stateless). */
export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const token = process.env.MCP_ACCESS_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'MCP не настроен (MCP_ACCESS_TOKEN)' });
    return;
  }
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${token}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const server = buildContentMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
