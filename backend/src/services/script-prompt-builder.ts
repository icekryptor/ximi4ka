import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BrandDoc } from '../entities/BrandDoc'
import { ContentUnit } from '../entities/ContentUnit'

const STRATEGY_SLUG = 'strategy_current'
const CAROUSEL_GUIDELINE_SLUG = 'style_guide_carousel'

/**
 * Builds a self-contained prompt for Claude that includes:
 * - Marketing strategy (north star) — BrandDoc[slug='strategy_current']
 * - Carousel style guide — BrandDoc[slug='style_guide_carousel']
 * - Rubric tone/audience/CTA
 * - Unit draft: title, hook, essence, body_caption, slides
 *
 * Missing sources (no rubric, empty guideline) are silently omitted —
 * the prompt stays well-formed instead of leaking 'null'/'undefined'.
 *
 * Side effect: if BrandDoc[slug='style_guide_carousel'] is missing, creates
 * an empty stub so the user can fill it from the UI without redeploying.
 *
 * @throws Error with message 'unit_not_found' if the unit doesn't exist
 * @throws Error with message 'not_carousel' if content_type !== 'carousel'
 */
export async function buildScriptPrompt(unitId: string): Promise<string> {
  const unitRepo = AppDataSource.getRepository(ContentUnit)
  const docRepo = AppDataSource.getRepository(BrandDoc)

  const unit = await unitRepo.findOne({
    where: { id: unitId },
    relations: ['rubric'],
  })
  if (!unit) throw new Error('unit_not_found')
  if (unit.content_type !== 'carousel') throw new Error('not_carousel')

  // Load both brand docs in a single query.
  const docs = await docRepo.find({
    where: { slug: In([STRATEGY_SLUG, CAROUSEL_GUIDELINE_SLUG]) },
  })
  const docMap = new Map(docs.map((d) => [d.slug, d.content]))

  // Auto-seed carousel guideline doc so it appears in the BrandDoc editor.
  if (!docMap.has(CAROUSEL_GUIDELINE_SLUG)) {
    const stub = docRepo.create({
      slug: CAROUSEL_GUIDELINE_SLUG,
      title: 'Гайдлайн карусели',
      content: '',
    })
    await docRepo.save(stub)
    docMap.set(CAROUSEL_GUIDELINE_SLUG, '')
  }

  const strategy = docMap.get(STRATEGY_SLUG) ?? ''
  const guideline = docMap.get(CAROUSEL_GUIDELINE_SLUG) ?? ''

  const parts: string[] = []

  if (strategy.trim()) {
    parts.push('[NORTH STAR — МАРКЕТИНГ-СТРАТЕГИЯ]')
    parts.push(strategy.trim())
  }

  if (guideline.trim()) {
    parts.push('[ГАЙДЛАЙН ПО КАРУСЕЛЯМ]')
    parts.push(guideline.trim())
  }

  if (unit.rubric) {
    const r = unit.rubric
    const rubricLines = [`[РУБРИКА: ${r.title}]`]
    if (r.tone) rubricLines.push(`Tone: ${r.tone}`)
    if (r.audience) rubricLines.push(`Audience: ${r.audience}`)
    if (r.cta_template) rubricLines.push(`CTA: ${r.cta_template}`)
    if (rubricLines.length > 1) parts.push(rubricLines.join('\n'))
  }

  const taskLines = ['[ЗАДАЧА]', 'Тип: карусель']
  taskLines.push(`Название: ${unit.title}`)
  if (unit.hook) taskLines.push(`Hook: ${unit.hook}`)
  if (unit.essence) taskLines.push(`Суть: ${unit.essence}`)
  taskLines.push('')
  taskLines.push(`Подпись (draft): ${unit.body_caption?.trim() || '<пусто>'}`)
  taskLines.push('Слайды (draft):')
  const slides = Array.isArray(unit.slides) ? unit.slides : []
  if (slides.length === 0) {
    taskLines.push('  <слайды ещё не описаны>')
  } else {
    slides.forEach((s, i) => {
      taskLines.push(`  ${i + 1}. text: ${s.text?.trim() || '<пусто>'}`)
      taskLines.push(`     visual: ${s.visual?.trim() || '<пусто>'}`)
    })
  }
  parts.push(taskLines.join('\n'))

  parts.push(
    '[ЧТО НУЖНО]\n' +
      'Напиши финальную версию: подпись поста и текст каждого слайда. ' +
      'Соблюдай гайдлайн и тон рубрики. Опирайся на маркетинг-стратегию как на north star. ' +
      'Для каждого слайда дай: (а) короткий текст на самом слайде, (б) визуальную идею.',
  )

  return parts.join('\n\n')
}
