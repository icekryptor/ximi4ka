import { Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { getPromptCache } from '../services/prompt-cache'
import { parseClaudeJson, splitIntoSentenceChunks } from '../lib/parse-claude-json'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const MODEL = 'claude-sonnet-4-5-20250929'

async function callClaude(system: string, user: string, maxTokens = 4096): Promise<string> {
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

function handleClaudeError(e: any, res: Response, defaultMsg: string) {
  // Verbose logging — captures everything we might need for debugging when
  // a request fails. Anthropic SDK errors carry status + a response body
  // (string or object) that explains what went wrong (invalid model,
  // max_tokens out of range, billing issue, content-policy block, etc.)
  const status = e?.status || e?.response?.status
  const errMessage = e?.message
  const errType = e?.error?.type || e?.response?.data?.error?.type
  const errBody = e?.error?.message || e?.response?.data?.error?.message
  console.error(
    `[Claude error] status=${status ?? 'n/a'} type=${errType ?? 'n/a'} ` +
      `message="${errMessage ?? 'n/a'}" body="${(errBody ?? '').toString().slice(0, 300)}"`,
  )
  if (status === 429) {
    return res.status(503).json({ error: 'Сервис временно перегружен, попробуйте через минуту' })
  }
  if (status === 401) {
    console.error('Claude auth error — check ANTHROPIC_API_KEY')
    return res.status(500).json({ error: defaultMsg })
  }
  if (e?.code === 'ETIMEDOUT' || e?.name === 'TimeoutError') {
    return res.status(504).json({ error: 'Превышено время ожидания, попробуйте ещё раз' })
  }
  return res.status(500).json({ error: defaultMsg })
}

export const claudeController = {
  async generate(req: Request, res: Response) {
    try {
      const { topic, brand = 'Химичка', duration = '60', styles = [] } = req.body as {
        topic?: string
        brand?: string
        duration?: string
        styles?: string[]
      }
      if (!topic || !topic.trim()) {
        return res.status(400).json({ error: 'Поле topic обязательно' })
      }
      const cache = await getPromptCache()
      const stylesStr = styles.length > 0 ? styles.join(', ') : 'образовательный'
      const system = `Ты — сценарист коротких видео (TikTok, Reels) для бренда ${brand} (ximi4ka.ru). Производим наборы для химических опытов, продаём на Wildberries.

## Стилевой гайд (обязательно к исполнению)
${cache.brandDocs.style_guide_video}

## Матрица рубрик
${cache.brandDocs.rubrics_matrix}

## Эталонный сценарий (образец стиля, тона, ритма)
${cache.etalonScript ?? 'Не загружен.'}

## Задача
Напиши сценарий по теме ниже. Стиль: ${stylesStr}. Длина: ~${duration} сек.
Структура: ХУК → ЗАЯВКА → ОБЪЯСНЕНИЕ → РАЗВЯЗКА → ВЫВОД.
CTA-формула: «Найти нас можно по слову "Химичка" в поисковиках, ВБ и Озон».
Только текст сценария, без пояснений, без разметки визуал/речь. Абзацами, как будет говориться вслух.
Перед написанием определи рубрику и её тональную группу из матрицы, примени соответствующие правила.`
      const text = await callClaude(system, topic, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка генерации сценария')
    }
  },

  async factcheck(req: Request, res: Response) {
    try {
      const { script } = req.body as { script?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const system = `Ты — редактор и фактчекер бренда Химичка (наборы для химических опытов).

ОСОБЫЕ ЗОНЫ ВНИМАНИЯ:
- Цитаты, даты, имена, названия конвенций — обязательна точность
- Свойства химических веществ: запах, токсичность, число атомов, формулы
- Количество жертв, исторические факты
- Названия организаций (ОЗХО, не ОПХО и т.д.)

Проверь текст. Ответь строго JSON-массивом: [{"type":"ok"|"warn"|"err","text":"описание"}]. Только JSON.`
      const raw = await callClaude(system, script, 2048)
      const items = parseClaudeJson(
        raw,
        (v) => (Array.isArray(v) ? (v as Array<{ type: string; text: string }>) : null),
        'factcheck',
      ) ?? [{ type: 'info', text: raw.slice(0, 1000) }]
      res.json({ items })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка фактчекинга')
    }
  },

  async style(req: Request, res: Response) {
    try {
      const { script, brand = 'Химичка' } = req.body as {
        script?: string
        brand?: string
      }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const cache = await getPromptCache()
      const system = `Ты — редактор бренда ${brand}. Обработай сценарий по стилевому гайду ниже.

## Стилевой гайд
${cache.brandDocs.style_guide_video}

## Задача
Примени все 14 базовых правил, аудиальные правила А1–А10, стилистические С1–С9, уточнения Э1–Э7.
Проверь: нет ли прокладок, разжёвывания, пафоса, лишних мемов.
Прочитай мысленно вслух — есть ли ритм? Не спотыкается ли голос?
Верни только финальный текст без пояснений.`
      const text = await callClaude(system, script, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка стиль-фильтра')
    }
  },

  async edit(req: Request, res: Response) {
    try {
      const { script, notes } = req.body as { script?: string; notes?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      if (!notes || !notes.trim()) {
        return res.status(400).json({ error: 'Поле notes обязательно' })
      }
      const system = `Ты — редактор. Примени правки к тексту. Правки: "${notes}". Только готовый текст.`
      const text = await callClaude(system, script, 4096)
      res.json({ text })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка применения правок')
    }
  },

  async editWithLearning(req: Request, res: Response) {
    try {
      const { originalScript, notes, editedScript } = req.body as {
        originalScript?: string
        notes?: string
        editedScript?: string
      }
      if (!originalScript || !originalScript.trim()) {
        return res.status(400).json({ error: 'Поле originalScript обязательно' })
      }
      if (!notes?.trim() && !editedScript?.trim()) {
        return res.status(400).json({ error: 'Нужно указать notes или editedScript' })
      }

      const cache = await getPromptCache()
      const system = `Ты — редактор бренда Химичка. Тебе показывают исходный сценарий и правки от оператора.
У оператора есть два режима ввода правок:
1. Свободные заметки (текст с указаниями: что поменять и почему)
2. Отредактированная версия сценария (новая версия, в которой уже сделаны правки)

## Стилевой гайд (текущая версия)
${cache.brandDocs.style_guide_video}

## Твоя задача
1. Если есть editedScript — используй его как новую версию. Если только notes — примени правки к originalScript и создай новую версию.
2. Проанализируй РАЗНИЦУ между originalScript и новой версией (или смысл notes).
3. Извлеки СМЫСЛОВЫЕ ПАТТЕРНЫ — общие правила, которые стоит добавить в стилевой гайд, чтобы при будущих генерациях не повторять ту же ошибку.
4. Каждый паттерн должен быть в формате существующих дополнений к гайду (А{N}, С{N}, Э{N}):
   - code: следующий свободный номер в правильной категории. Категории:
     * А (А11+) — аудиальные правила (произношение, ритм, артикуляция)
     * С (С10+) — структурные/лексические правила (конструкции, образы, сюжет)
     * Э (Э8+) — финальные уточнения (узкие правила из конкретного редактирования)
   - title: короткое название правила (5-10 слов)
   - before: пример «как НЕ надо» (одна фраза из исходного сценария, если применимо)
   - after: пример «как надо» (одна фраза из новой версии, если применимо)
   - rationale: 1-2 предложения объясняющие почему

5. Не выдумывай паттерны если их нет. Лучше вернуть 0 паттернов чем мусор.
6. Игнорируй тривиальные правки (опечатки, перестановка слов без смысла).
7. Если правка ОДИН РАЗ — это не паттерн. Паттерн — это правило, которое применимо к любому будущему сценарию.

## Формат ответа
Строго JSON:
{
  "finalScript": "полная новая версия сценария",
  "summary": "1-2 предложения о сути правок",
  "patterns": [
    { "code": "Э8", "title": "...", "before": "...", "after": "...", "rationale": "..." }
  ]
}
Только JSON, без пояснений.`

      const userPayload = JSON.stringify({
        originalScript,
        notes: notes ?? null,
        editedScript: editedScript ?? null,
      })
      const raw = await callClaude(system, userPayload, 4096)
      const parsed = parseClaudeJson(
        raw,
        (v) => {
          if (
            v &&
            typeof v === 'object' &&
            typeof (v as any).finalScript === 'string'
          ) {
            const result = v as { finalScript: string; summary?: string; patterns?: any[] }
            return {
              finalScript: result.finalScript,
              summary: typeof result.summary === 'string' ? result.summary : '',
              patterns: Array.isArray(result.patterns) ? result.patterns : [],
            }
          }
          return null
        },
        'edit-with-learning',
      )
      const finalParsed = parsed ?? {
        finalScript: editedScript ?? originalScript,
        summary: raw.slice(0, 200),
        patterns: [],
      }
      res.json(finalParsed)
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка обучения на правках')
    }
  },

  async preprocess(req: Request, res: Response) {
    try {
      const { script } = req.body as { script?: string }
      if (!script || !script.trim()) {
        return res.status(400).json({ error: 'Поле script обязательно' })
      }
      const system = `Ты — препроцессор текста для синтеза речи ElevenLabs v3 (русский язык).

УДАРЕНИЯ:
- Расставь ударения ТОЛЬКО через символ U+0301 (комбинирующий акут) ПОСЛЕ ударной гласной.
- НИКОГДА не дублируй гласные (не "замоок", а "замо́к"). Только символ ́ .
- Ставь только в неоднозначных словах: омографы (замо́к/за́мок, сто́ит/стои́т), редкие ударения, иностранные слова, имена.
- Не ставь там, где ударение и так очевидно для TTS.

ЭМОЦИОНАЛЬНЫЕ ТЕГИ:
- Доступные теги: [thoughtful] [whisper] [serious] [authoritative] [happy] [sad] [chuckle] [annoyed] [narrator] [somber].
- Ставь перед фразой/предложением, только там где реально нужна смена интонации.
- Не переусердствуй — не каждая фраза нуждается в теге.
- Для CTA (призыв к действию в конце) — используй связку [chuckle] → [thoughtful] или [happy], это снимает "рекламность".
- Для перечислений запретного/опасного — [whisper] создаёт ощущение запретного знания.
- Для исторических фактов — [narrator] или [serious], не перегружая.

ТЕКСТОВАЯ ОБРАБОТКА:
- Латиницу переводи в кириллицу фонетически: VX → вэ-икс, Wildberries → Вайлдберриз, eSIM → и-сим, FBI → ФБР, Northwestern → Нортвестерн (правило С6 из гайда).
- Числа и аббревиатуры пиши прописью: 54.1 → пятьдесят четыре целых одна десятая, НК → Налоговый кодекс.
- Тире (—) заменяй на точки или запятые — модель путается с интонацией на тире. ИСКЛЮЧЕНИЕ: «Но —» в начале предложения оставь — это интонационная пауза-вдох перед выводом (правило С7).
- Многоточия (...) заменяй на точку + новое предложение — многоточия провоцируют странные паузы.
- Точка с запятой = короткая пауза, точка = длиннее. Используй это для ритма.
- Скобки внутри текста = интонационное понижение, шёпот в сторону (правило А9). Не трогай их — ElevenLabs v3 обрабатывает их как тихий комментарий.
- Если предлог идёт в быстром ударном месте — выбирай короткий: «о» вместо «про» (правило А3).

ЧАНКИ:
- Раздели текст на чанки по 200-350 символов.
- Режь по смыслу — не рубй фразы на полуслове.
- Каждый чанк должен быть самостоятельной единицей для озвучки.

Формат: строго JSON {"chunks":["чанк1","чанк2",...]}. Только JSON, без пояснений.`
      // 4096 — restored from the temporary 8192 bump. The Anthropic SDK
      // rejected 8192 with a generic error mapped to 'Ошибка препроцессинга'
      // on the client. Sonnet 4.5 supports up to 64k output tokens per docs,
      // but something in the SDK or request chain doesn't accept 8192 here.
      // If preprocess truncates mid-JSON at 4096, switch to streaming or
      // request output_size beta header — not 8192 raw.
      const raw = await callClaude(system, script, 4096)
      const parsed = parseClaudeJson(
        raw,
        (v) => {
          if (v && typeof v === 'object' && Array.isArray((v as any).chunks)) {
            const chunks = (v as { chunks: unknown[] }).chunks
              .filter((c): c is string => typeof c === 'string')
            if (chunks.length > 0) return { chunks }
          }
          return null
        },
        'preprocess',
      )
      // Graceful fallback: if parsing failed entirely, split the raw response
      // into sentence-based chunks of ~300 chars rather than dumping it as a
      // single giant blob. Better UX than the previous [raw] behaviour.
      const chunks = parsed?.chunks ?? splitIntoSentenceChunks(raw, 300)
      res.json({ chunks })
    } catch (e: any) {
      handleClaudeError(e, res, 'Ошибка препроцессинга')
    }
  },
}
