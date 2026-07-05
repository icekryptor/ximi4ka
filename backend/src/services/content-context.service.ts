import { AppDataSource } from '../config/database';
import { BrandDoc } from '../entities/BrandDoc';
import { IcpSegment } from '../entities/IcpSegment';
import { ContentRubric } from '../entities/ContentRubric';
import { StrategicTheme } from '../entities/StrategicTheme';
import { ContentPlanItem } from '../entities/ContentPlanItem';
import { getPromptCache, invalidatePromptCache } from './prompt-cache';

// Чистые сборщики контекста контент-движка (без Request/Response).
// Переиспользуются blueprint-эндпоинтом content-engine.controller и MCP-сервером.

const PLAN_DOC_SLUG = 'content_plan_current';
const FUNNEL_DEFAULT =
  '(воронка не задана — используй дефолт: TOFU — охват/узнаваемость, MOFU — вовлечение/доверие, BOFU — конверсия)';

const brandRepo = () => AppDataSource.getRepository(BrandDoc);
const segmentRepo = () => AppDataSource.getRepository(IcpSegment);
const rubricRepo = () => AppDataSource.getRepository(ContentRubric);
const themeRepo = () => AppDataSource.getRepository(StrategicTheme);
const planItemRepo = () => AppDataSource.getRepository(ContentPlanItem);

export interface PlannerSegment {
  slug: string;
  name: string;
  role: string | null;
  age_range: string | null;
  description: string | null;
}

export interface SegmentRef {
  slug: string;
  name: string;
  role: string | null;
  age_range: string | null;
}

export interface RubricRef {
  slug: string;
  title: string;
}

export interface PlannerContext {
  funnel: string;
  segments: PlannerSegment[];
  strategySummary: string;
  plan: { markdown: string; items: ContentPlanItem[] };
  brief: string; // собранный текстовый бриф (как planner promptPreview в blueprint)
}

export interface WriterContext {
  styleGuideText: string;
  styleGuideVideo: string;
  rubricsMatrix: string;
  strategyPhase: string;
  planMarkdown: string;
  segment: { slug: string; name: string; description: string | null } | null;
  rubric: RubricRef | null;
  brief: string;
}

export interface AddPlanItemInput {
  funnel_level: 'TOFU' | 'MOFU' | 'BOFU';
  format: string;
  goal: string;
  plan_date?: string;
  segment_slug?: string;
  theme_slug?: string;
  status?: 'planned' | 'in_progress' | 'published';
}

export interface UpdatePlanItemPatch {
  status?: 'planned' | 'in_progress' | 'published';
  goal?: string;
  plan_date?: string;
  funnel_level?: 'TOFU' | 'MOFU' | 'BOFU';
}

/** Активные ICP-сегменты (полные — для Planner-брифа). */
async function loadActiveSegments(): Promise<PlannerSegment[]> {
  const rows = await segmentRepo().find({
    where: { active: true },
    order: { sort_order: 'ASC' },
  });
  return rows.map((s) => ({
    slug: s.slug,
    name: s.name,
    role: s.role,
    age_range: s.age_range,
    description: s.description,
  }));
}

/** Полный контекст для агента-планировщика. Собирает воронку, активные
 *  ICP-сегменты, выжимку стратегии и текущий контент-план. Бриф идентичен
 *  planner promptPreview из content-engine blueprint. */
export async function getPlannerContext(): Promise<PlannerContext> {
  const cache = await getPromptCache();
  const funnel = cache.brandDocs.funnel_levels ?? '';
  const strategySummary = cache.brandDocs.strategy_summary ?? '';
  const planMarkdown = cache.brandDocs.content_plan_current ?? '';
  const segments = await loadActiveSegments();
  const items = await planItemRepo().find({
    order: { sort_order: 'ASC', plan_date: 'ASC' },
  });

  const segLines = segments.length
    ? segments
        .map(
          (s) =>
            `- ${s.name}${s.role ? ' (' + s.role + ')' : ''}${s.age_range ? ', ' + s.age_range : ''}`,
        )
        .join('\n')
    : '(сегменты не заданы)';

  const brief = `Ты — контент-стратег (Planner) бренда Химичка (наборы для химических опытов, ximi4ka.ru, продажи на WB и Ozon).

## Воронка
${funnel || FUNNEL_DEFAULT}

## Целевые сегменты
${segLines}

## Цели (из стратегии)
${strategySummary || '(выжимка стратегии не задана — держи фокус на познавательности и доверии к бренду)'}

## Задача
Составь контент-план на период: по каждому пункту укажи дату, уровень воронки (TOFU/MOFU/BOFU), сегмент, тему, формат и цель. Балансируй воронку. Верни markdown-таблицей.`;

  return {
    funnel,
    segments,
    strategySummary,
    plan: { markdown: planMarkdown, items },
    brief,
  };
}

/** Контекст для копирайтера (Writer): стиль-гайды, матрица рубрик, фаза
 *  стратегии, контент-план, деталь выбранного сегмента и рубрики. Бриф
 *  повторяет структуру системного промпта short_post.draft. */
export async function getWriterContext(opts: {
  segmentSlug?: string;
  rubricSlug?: string;
}): Promise<WriterContext> {
  const cache = await getPromptCache();
  const styleGuideText = cache.brandDocs.style_guide_text ?? '';
  const styleGuideVideo = cache.brandDocs.style_guide_video ?? '';
  const rubricsMatrix = cache.brandDocs.rubrics_matrix ?? '';
  const strategyPhase = cache.brandDocs.strategy_summary ?? '';
  const planMarkdown = cache.brandDocs.content_plan_current ?? '';

  let segment: WriterContext['segment'] = null;
  if (opts.segmentSlug) {
    const s = await segmentRepo().findOne({ where: { slug: opts.segmentSlug } });
    if (s) segment = { slug: s.slug, name: s.name, description: s.description };
  }

  let rubric: RubricRef | null = null;
  if (opts.rubricSlug) {
    const r = await rubricRepo().findOne({ where: { slug: opts.rubricSlug } });
    if (r) rubric = { slug: r.slug, title: r.title };
  }

  const segRow = opts.segmentSlug
    ? await segmentRepo().findOne({ where: { slug: opts.segmentSlug } })
    : null;
  const segmentBlock = segRow
    ? `${segRow.name} (${segRow.role ?? ''}, ${segRow.age_range ?? ''})
${segRow.description ?? ''}`
    : 'Сегмент не задан — пиши универсально, но с уклоном в познавательность.';

  const brief = `Ты — копирайтер бренда Химичка (наборы для химических опытов, ximi4ka.ru, продажи на WB и Ozon).

## Стилевой гайд (обязательно к исполнению)
${styleGuideText || '(не задан — используй нейтральный познавательный тон)'}

## Стратегический контекст (North Star)
${strategyPhase || '(выжимка стратегии не задана — держи фокус на познавательности и доверии к бренду)'}

## Целевой сегмент (пиши адресно под него)
${segmentBlock}

## Контент-план (пиши в рамках повестки)
${planMarkdown || '(план не задан — пиши по рубрике и идее ниже, держи фокус на повестке бренда)'}

## Матрица рубрик
${rubricsMatrix}

## Выбранная рубрика
${rubric ? rubric.title : 'не выбрана — определи рубрику и тональную группу из матрицы'}

## Задача
Напиши короткий пост для Telegram / VK / X.
Структура: хук (одна сильная первая строка) + 1-2 факта или мысль + закрытие.
Длина: 400-800 символов. Без хэштегов и markdown-разметки.`;

  return {
    styleGuideText,
    styleGuideVideo,
    rubricsMatrix,
    strategyPhase,
    planMarkdown,
    segment,
    rubric,
    brief,
  };
}

/** Строки текущего контент-плана (индекс). */
export async function listPlanItems(): Promise<ContentPlanItem[]> {
  return planItemRepo().find({ order: { sort_order: 'ASC', plan_date: 'ASC' } });
}

/** Справочник ICP-сегментов (slug + название + роль/возраст). */
export async function listSegments(): Promise<SegmentRef[]> {
  const rows = await segmentRepo().find({ order: { sort_order: 'ASC' } });
  return rows.map((s) => ({
    slug: s.slug,
    name: s.name,
    role: s.role,
    age_range: s.age_range,
  }));
}

/** Справочник рубрик (slug + название). */
export async function listRubrics(): Promise<RubricRef[]> {
  const rows = await rubricRepo().find({ order: { sort_order: 'ASC' } });
  return rows.map((r) => ({ slug: r.slug, title: r.title }));
}

/** Сохранить/перезаписать контент-план (markdown) в brand_doc content_plan_current.
 *  Upsert: обновляет существующий док или создаёт новый. Инвалидирует prompt-cache. */
export async function saveContentPlan(markdown: string): Promise<void> {
  const repo = brandRepo();
  const existing = await repo.findOne({ where: { slug: PLAN_DOC_SLUG } });
  if (existing) {
    existing.content = markdown;
    await repo.save(existing);
  } else {
    await repo.save(
      repo.create({
        slug: PLAN_DOC_SLUG,
        title: 'Контент-план',
        content: markdown,
      }),
    );
  }
  invalidatePromptCache();
}

/** Добавить строку в индекс контент-плана. Резолвит segment_slug/theme_slug → id;
 *  при промахе бросает Error со списком допустимых slug'ов. */
export async function addPlanItem(input: AddPlanItemInput): Promise<ContentPlanItem> {
  let segment_id: string | null = null;
  if (input.segment_slug) {
    const seg = await segmentRepo().findOne({ where: { slug: input.segment_slug } });
    if (!seg) {
      const valid = await segmentRepo().find({ order: { sort_order: 'ASC' } });
      const list = valid.map((s) => s.slug).join(', ') || '(нет сегментов)';
      throw new Error(
        `Сегмент со slug "${input.segment_slug}" не найден. Допустимые slug: ${list}`,
      );
    }
    segment_id = seg.id;
  }

  let theme_id: string | null = null;
  if (input.theme_slug) {
    const theme = await themeRepo().findOne({ where: { slug: input.theme_slug } });
    if (!theme) {
      const valid = await themeRepo().find({ order: { sort_order: 'ASC' } });
      const list = valid.map((t) => t.slug).join(', ') || '(нет тем)';
      throw new Error(
        `Тема со slug "${input.theme_slug}" не найдена. Допустимые slug: ${list}`,
      );
    }
    theme_id = theme.id;
  }

  const repo = planItemRepo();
  const item = repo.create({
    plan_date: input.plan_date ?? null,
    funnel_level: input.funnel_level ?? null,
    segment_id,
    theme_id,
    format: input.format ?? null,
    goal: input.goal ?? null,
    status: input.status ?? 'planned',
    sort_order: 0,
  });
  return repo.save(item);
}

/** Обновить строку плана по id. Возвращает обновлённую строку или null, если не найдена. */
export async function updatePlanItem(
  id: string,
  patch: UpdatePlanItemPatch,
): Promise<ContentPlanItem | null> {
  const repo = planItemRepo();
  const existing = await repo.findOne({ where: { id } });
  if (!existing) return null;

  const set: Partial<ContentPlanItem> = {};
  if ('plan_date' in patch) set.plan_date = patch.plan_date ?? null;
  if ('funnel_level' in patch) set.funnel_level = patch.funnel_level ?? null;
  if ('goal' in patch) set.goal = patch.goal ?? null;
  if ('status' in patch && patch.status) set.status = patch.status;

  if (Object.keys(set).length > 0) {
    await repo.update(id, set);
  }
  return repo.findOne({ where: { id } });
}

/** Удалить строку плана по id. Возвращает false, если строки не было. */
export async function deletePlanItem(id: string): Promise<boolean> {
  const r = await planItemRepo().delete(id);
  return (r.affected ?? 0) > 0;
}

// Вспомогательный слаг, чтобы избежать «магических строк» в вызывающем коде.
export const CONTENT_PLAN_DOC_SLUG = PLAN_DOC_SLUG;
