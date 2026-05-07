import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '../config/database'
import { ContentRubric } from '../entities/ContentRubric'
import { ContentUnit, ContentStatus } from '../entities/ContentUnit'
import seedJson from './data/chemichka_content_bank.json'

interface SeedRubric {
  id: number
  slug: string
  title: string
  emoji: string
  tone: string
  audience: string
  cta_template: string
}

interface SeedIdea {
  id: number
  rubric_id: number
  status: string
  complexity: number
  hook: string
  hook_ab: string
  visual: string
  essence: string
  notes: string | null
}

async function main() {
  await AppDataSource.initialize()
  const rubricRepo = AppDataSource.getRepository(ContentRubric)
  const unitRepo = AppDataSource.getRepository(ContentUnit)

  const rubrics = seedJson.rubrics as SeedRubric[]
  const ideas = seedJson.ideas as SeedIdea[]

  // 1. Find admin user for created_by
  const result = await AppDataSource.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
  )
  const adminId = result[0]?.id
  if (!adminId) {
    throw new Error('No admin user found — cannot set created_by. Create an admin user first.')
  }
  console.log(`Using admin user_id=${adminId} as created_by`)

  // 2. Seed rubrics
  let rubricsCreated = 0
  const slugToId = new Map<string, string>()
  for (const r of rubrics) {
    let existing = await rubricRepo.findOne({ where: { slug: r.slug } })
    if (existing) {
      slugToId.set(r.slug, existing.id)
      continue
    }
    const created = await rubricRepo.save(
      rubricRepo.create({
        slug: r.slug,
        title: r.title,
        emoji: r.emoji,
        tone: r.tone,
        audience: r.audience,
        cta_template: r.cta_template,
        sort_order: r.id,
      }),
    )
    slugToId.set(r.slug, created.id)
    rubricsCreated++
  }
  console.log(`Rubrics: ${rubricsCreated} created, ${rubrics.length - rubricsCreated} skipped`)

  // 3. Seed ideas
  // Map JSON rubric_id (1..6) → slug → uuid
  const seedRubricIdToSlug = new Map<number, string>()
  for (const r of rubrics) seedRubricIdToSlug.set(r.id, r.slug)

  let unitsCreated = 0
  for (const idea of ideas) {
    const slug = seedRubricIdToSlug.get(idea.rubric_id)
    if (!slug) {
      console.warn(`Skipping idea ${idea.id} — unknown rubric_id ${idea.rubric_id}`)
      continue
    }
    const rubricUuid = slugToId.get(slug)!

    // Skip if duplicate (rubric_id, hook)
    const existing = await unitRepo.findOne({ where: { rubric_id: rubricUuid, hook: idea.hook } })
    if (existing) continue

    const title = idea.hook.length > 80 ? idea.hook.slice(0, 80) : idea.hook
    await unitRepo.save(
      unitRepo.create({
        rubric_id: rubricUuid,
        content_type: 'short_video',
        status: idea.status as ContentStatus,
        complexity: idea.complexity,
        title,
        hook: idea.hook,
        hook_ab: idea.hook_ab,
        visual: idea.visual,
        essence: idea.essence,
        notes: idea.notes,
        video_url: null,
        created_by: adminId,
      }),
    )
    unitsCreated++
  }
  console.log(`Units: ${unitsCreated} created, ${ideas.length - unitsCreated} skipped`)

  await AppDataSource.destroy()
  console.log('Done.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
