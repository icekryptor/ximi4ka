import { Request, Response } from 'express'
import { In, IsNull } from 'typeorm'
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'
import { ContentRubric } from '../entities/ContentRubric'
import { ContentPublication } from '../entities/ContentPublication'
import { saveImportPlan, getImportPlan, deleteImportPlan, ImportPlan } from '../services/import-token-store'

const repo = AppDataSource.getRepository(ContentUnit)

export const contentUnitController = {
  async getAll(req: Request, res: Response) {
    try {
      const {
        status,
        rubric_id,
        content_type,
        network,
        review_grade,
        search,
        sort = 'created_at',
      } = req.query as Record<string, string | undefined>

      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))

      // We deliberately do NOT joinAndSelect publications here. With skip/take
      // and a one-to-many joinAndSelect, TypeORM wraps the query in a DISTINCT
      // pagination layer that can't reference correlated aggregate subqueries
      // in ORDER BY (the scheduled_at sort blew up with a 500). Instead, we
      // load publications in a single batch query after pagination is settled.
      const qb = repo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.rubric', 'r')

      if (status) qb.andWhere('u.status IN (:...statuses)', { statuses: status.split(',') })
      if (rubric_id) qb.andWhere('u.rubric_id IN (:...rubrics)', { rubrics: rubric_id.split(',') })
      if (content_type)
        qb.andWhere('u.content_type IN (:...types)', { types: content_type.split(',') })
      if (network) {
        qb.andWhere(
          'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.network IN (:...networks))',
          { networks: network.split(',') },
        )
      }
      if (review_grade) {
        const grades = review_grade.split(',')
        if (grades.includes('null')) {
          const rest = grades.filter(g => g !== 'null')
          if (rest.length > 0) {
            qb.andWhere('(u.review_grade IS NULL OR u.review_grade IN (:...rest))', { rest })
          } else {
            qb.andWhere('u.review_grade IS NULL')
          }
        } else {
          qb.andWhere('u.review_grade IN (:...grades)', { grades })
        }
      }
      if (search) {
        qb.andWhere(
          '(u.title ILIKE :s OR u.hook ILIKE :s OR u.hook_ab ILIKE :s OR u.essence ILIKE :s)',
          { s: `%${search}%` },
        )
      }

      // Sort
      if (sort === 'title') {
        qb.orderBy('u.title', 'ASC')
      } else if (sort === 'status') {
        qb.orderBy('u.status', 'ASC').addOrderBy('u.created_at', 'DESC')
      } else if (sort === 'scheduled_at') {
        // Sort by earliest scheduled publication. Per-network filter is mirrored
        // inside the subquery so team workflows can sort per platform.
        const networkClause = network ? ' AND cp_sort.network IN (:...networks_sort)' : ''
        qb.orderBy(
          `(SELECT MIN(cp_sort.scheduled_at) FROM content_publications cp_sort WHERE cp_sort.content_unit_id = u.id${networkClause})`,
          'ASC',
          'NULLS LAST',
        ).addOrderBy('u.created_at', 'DESC')
        if (network) qb.setParameter('networks_sort', network.split(','))
      } else {
        qb.orderBy('u.created_at', 'DESC')
      }

      const [units, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()

      // Hydrate publications for the page (one batch query, sorted by sort_order).
      const ids = units.map(u => u.id)
      const data = units as ContentUnit[]
      if (ids.length > 0) {
        const pubRepo = AppDataSource.getRepository(ContentPublication)
        const allPubs = await pubRepo.find({
          where: { content_unit_id: In(ids) },
          order: { sort_order: 'ASC', created_at: 'ASC' },
        })
        const pubsByUnit = new Map<string, ContentPublication[]>()
        for (const p of allPubs) {
          const arr = pubsByUnit.get(p.content_unit_id) || []
          arr.push(p)
          pubsByUnit.set(p.content_unit_id, arr)
        }
        for (const u of data) u.publications = pubsByUnit.get(u.id) || []
      }

      res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (e) {
      console.error('Error fetching units:', e)
      res.status(500).json({ error: 'Ошибка загрузки единиц' })
    }
  },

  async ungradedCount(req: Request, res: Response) {
    try {
      const count = await repo.count({ where: { review_grade: IsNull() } })
      res.json({ count })
    } catch (e) {
      console.error('Error counting ungraded units:', e)
      res.status(500).json({ error: 'Ошибка подсчёта неоценённых' })
    }
  },

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

  async export(req: Request, res: Response) {
    try {
      const {
        status,
        rubric_id,
        content_type,
        network,
        review_grade,
        search,
      } = req.query as Record<string, string | undefined>

      const qb = repo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.rubric', 'r')
        .leftJoinAndSelect('u.publications', 'p')

      if (status) qb.andWhere('u.status IN (:...statuses)', { statuses: status.split(',') })
      if (rubric_id) qb.andWhere('u.rubric_id IN (:...rubrics)', { rubrics: rubric_id.split(',') })
      if (content_type) qb.andWhere('u.content_type IN (:...types)', { types: content_type.split(',') })
      if (network) {
        qb.andWhere(
          'EXISTS (SELECT 1 FROM content_publications cp WHERE cp.content_unit_id = u.id AND cp.network IN (:...networks))',
          { networks: network.split(',') },
        )
      }
      if (review_grade) {
        const grades = review_grade.split(',')
        if (grades.includes('null')) {
          const rest = grades.filter(g => g !== 'null')
          if (rest.length > 0) {
            qb.andWhere('(u.review_grade IS NULL OR u.review_grade IN (:...rest))', { rest })
          } else {
            qb.andWhere('u.review_grade IS NULL')
          }
        } else {
          qb.andWhere('u.review_grade IN (:...grades)', { grades })
        }
      }
      if (search) {
        qb.andWhere(
          '(u.title ILIKE :s OR u.hook ILIKE :s OR u.hook_ab ILIKE :s OR u.essence ILIKE :s)',
          { s: `%${search}%` },
        )
      }

      qb.orderBy('r.sort_order', 'ASC')
        .addOrderBy('u.created_at', 'ASC')
        .addOrderBy('u.id', 'ASC')
      const units = await qb.getMany()

      const rubricRepo = AppDataSource.getRepository(ContentRubric)
      const rubrics = await rubricRepo.find({ order: { sort_order: 'ASC', id: 'ASC' } })

      const payload = {
        meta: {
          exported_at: new Date().toISOString(),
          version: '1.0',
          total_units: units.length,
          filters_applied: {
            status: status || null,
            rubric_id: rubric_id || null,
            content_type: content_type || null,
            network: network || null,
            search: search || null,
            review_grade: review_grade || null,
          },
        },
        rubrics: rubrics.map(r => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          emoji: r.emoji,
          tone: r.tone,
          audience: r.audience,
          cta_template: r.cta_template,
          sort_order: r.sort_order,
        })),
        units: units.map(u => ({
          id: u.id,
          rubric_slug: u.rubric?.slug || null,
          content_type: u.content_type,
          status: u.status,
          complexity: u.complexity,
          title: u.title,
          hook: u.hook,
          hook_ab: u.hook_ab,
          visual: u.visual,
          essence: u.essence,
          notes: u.notes,
          video_url: u.video_url,
          review_grade: u.review_grade,
          review_feedback: u.review_feedback,
          reviewed_at: u.reviewed_at,
          publications: (u.publications || []).map(p => ({
            network: p.network,
            scheduled_at: p.scheduled_at,
            published_at: p.published_at,
            published_url: p.published_url,
            notes: p.notes,
          })),
          created_at: u.created_at,
          updated_at: u.updated_at,
        })),
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="content-bank-export-${Date.now()}.json"`,
      )
      res.json(payload)
    } catch (e) {
      console.error('Error exporting units:', e)
      res.status(500).json({ error: 'Ошибка экспорта' })
    }
  },

  async importPreview(req: Request, res: Response) {
    try {
      if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })
      let json: any
      try {
        json = JSON.parse(req.file.buffer.toString('utf-8'))
      } catch {
        return res.status(400).json({ error: 'Невалидный JSON' })
      }

      const errors: string[] = []
      const warnings: string[] = []

      if (!json.units || !Array.isArray(json.units)) {
        return res.status(400).json({ error: 'JSON должен содержать массив units[]' })
      }

      const rubricRepo = AppDataSource.getRepository(ContentRubric)
      const existingRubrics = await rubricRepo.find()
      const slugToRubric = new Map(existingRubrics.map(r => [r.slug, r]))

      const plannedRubrics: ImportPlan['rubrics'] = []
      let rubricsToCreate = 0
      let rubricsToSkip = 0
      if (Array.isArray(json.rubrics)) {
        for (const r of json.rubrics) {
          if (!r || typeof r !== 'object' || Array.isArray(r) || !r.slug || !r.title) {
            errors.push(`Рубрика без slug или title: ${JSON.stringify(r)}`)
            continue
          }
          const existing = slugToRubric.get(r.slug)
          plannedRubrics.push({
            slug: r.slug,
            title: r.title,
            emoji: r.emoji ?? null,
            tone: r.tone ?? null,
            audience: r.audience ?? null,
            cta_template: r.cta_template ?? null,
            sort_order: r.sort_order ?? 0,
            existing_id: existing?.id ?? null,
          })
          if (existing) rubricsToSkip++
          else rubricsToCreate++
        }
      }

      let unitsToInsert = 0
      let unitsToUpdate = 0
      let unitsToSkip = 0
      const plannedUnits: ImportPlan['units'] = []

      for (const incoming of json.units) {
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
          errors.push(`Невалидная единица: ${JSON.stringify(incoming)}`)
          continue
        }

        const incomingObj = incoming as Record<string, unknown>

        // Check rubric_slug existence (unknown slug → warning, unit will be created without rubric)
        if (incomingObj.rubric_slug && typeof incomingObj.rubric_slug === 'string' &&
            !slugToRubric.has(incomingObj.rubric_slug) &&
            !plannedRubrics.find(r => r.slug === incomingObj.rubric_slug)) {
          warnings.push(`rubric_slug '${incomingObj.rubric_slug}' не найден — единица будет без рубрики`)
        }

        // UPDATE path: id present and exists in DB
        if (typeof incomingObj.id === 'string') {
          const existing = await repo.findOne({ where: { id: incomingObj.id } })
          if (existing) {
            plannedUnits.push({
              incoming: incomingObj,
              action: 'update',
              existing_id: existing.id,
            })
            unitsToUpdate++
            continue
          }
        }

        // Skip-on-duplicate by (rubric_id from slug, hook)
        if (typeof incomingObj.rubric_slug === 'string' &&
            typeof incomingObj.hook === 'string' && incomingObj.hook) {
          const existingRubric = slugToRubric.get(incomingObj.rubric_slug)
          if (existingRubric) {
            const dup = await repo.findOne({
              where: { rubric_id: existingRubric.id, hook: incomingObj.hook },
            })
            if (dup) {
              plannedUnits.push({
                incoming: incomingObj,
                action: 'skip',
                existing_id: dup.id,
                skip_reason: 'duplicate (rubric_id, hook)',
              })
              unitsToSkip++
              continue
            }
          }
        }

        plannedUnits.push({ incoming: incomingObj, action: 'insert', existing_id: null })
        unitsToInsert++
      }

      const token = saveImportPlan({
        rubrics: plannedRubrics,
        units: plannedUnits,
        user_id: req.user!.userId,
        created_at: Date.now(),
      })

      res.json({
        rubrics: {
          to_create: rubricsToCreate,
          to_skip: rubricsToSkip,
          parsed_total: plannedRubrics.length,
        },
        units: {
          to_insert: unitsToInsert,
          to_update: unitsToUpdate,
          to_skip_duplicate: unitsToSkip,
          parsed_total: plannedUnits.length,
        },
        errors,
        warnings,
        preview_token: token,
      })
    } catch (e) {
      console.error('Error in import preview:', e)
      res.status(500).json({ error: 'Ошибка предварительного разбора' })
    }
  },

  async importCommit(req: Request, res: Response) {
    try {
      const { preview_token } = req.body
      if (!preview_token) return res.status(400).json({ error: 'preview_token обязателен' })

      const plan = getImportPlan(preview_token)
      if (!plan) return res.status(404).json({ error: 'Токен истёк или не найден. Загрузите файл заново.' })

      const PROTECTED = new Set(['id', 'review_grade', 'review_feedback', 'reviewed_at',
        'created_by', 'created_at', 'updated_at', 'rubric', 'rubric_slug', 'publications'])

      const stripProtected = (incoming: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(incoming)) {
          if (!PROTECTED.has(k)) out[k] = v
        }
        return out
      }

      const rubricRepo = AppDataSource.getRepository(ContentRubric)
      const publicationRepo = AppDataSource.getRepository(ContentPublication)

      let rubricsCreated = 0
      let rubricsSkipped = 0
      const slugToId = new Map<string, string>()
      for (const r of plan.rubrics) {
        if (r.existing_id) {
          slugToId.set(r.slug, r.existing_id)
          rubricsSkipped++
        } else {
          const created = await rubricRepo.save(rubricRepo.create({
            slug: r.slug,
            title: r.title,
            emoji: r.emoji,
            tone: r.tone,
            audience: r.audience,
            cta_template: r.cta_template,
            sort_order: r.sort_order,
          }))
          slugToId.set(r.slug, created.id)
          rubricsCreated++
        }
      }
      // Backfill slugToId with rubrics that exist in DB but weren't in the incoming JSON
      const allRubrics = await rubricRepo.find()
      for (const r of allRubrics) if (!slugToId.has(r.slug)) slugToId.set(r.slug, r.id)

      let unitsInserted = 0
      let unitsUpdated = 0
      let unitsSkipped = 0

      for (const item of plan.units) {
        if (item.action === 'skip') {
          unitsSkipped++
          continue
        }

        const incoming = item.incoming as Record<string, any>
        const patch: Record<string, any> = stripProtected(incoming)

        // Only override rubric_id when rubric_slug is explicitly present in the incoming JSON.
        // AI agents may emit JSON for prose-only changes without rubric_slug — don't unrubric existing units silently.
        if ('rubric_slug' in incoming) {
          patch.rubric_id = (typeof incoming.rubric_slug === 'string' && incoming.rubric_slug)
            ? (slugToId.get(incoming.rubric_slug) || null)
            : null
        }

        if (item.action === 'update' && item.existing_id) {
          await repo.update(item.existing_id, patch)
          // Replace publications: delete old, insert new
          await publicationRepo.delete({ content_unit_id: item.existing_id })
          for (const p of (incoming.publications || [])) {
            if (!p || typeof p !== 'object' || typeof p.network !== 'string') continue
            await publicationRepo.save(publicationRepo.create({
              content_unit_id: item.existing_id,
              network: p.network,
              scheduled_at: p.scheduled_at ? new Date(p.scheduled_at) : null,
              published_at: p.published_at ? new Date(p.published_at) : null,
              published_url: p.published_url ?? null,
              notes: p.notes ?? null,
            }))
          }
          unitsUpdated++
        } else {
          // INSERT
          const title = (typeof patch.title === 'string' && patch.title.trim()) ||
            (typeof incoming.hook === 'string' && incoming.hook ? String(incoming.hook).slice(0, 80) : 'Без названия')
          const created = await repo.save(repo.create({
            ...patch,
            title,
            created_by: plan.user_id,
          }))
          for (const p of (incoming.publications || [])) {
            if (!p || typeof p !== 'object' || typeof p.network !== 'string') continue
            await publicationRepo.save(publicationRepo.create({
              content_unit_id: created.id,
              network: p.network,
              scheduled_at: p.scheduled_at ? new Date(p.scheduled_at) : null,
              published_at: p.published_at ? new Date(p.published_at) : null,
              published_url: p.published_url ?? null,
              notes: p.notes ?? null,
            }))
          }
          unitsInserted++
        }
      }

      deleteImportPlan(preview_token)

      res.json({
        rubrics: { created: rubricsCreated, skipped: rubricsSkipped },
        units: { inserted: unitsInserted, updated: unitsUpdated, skipped: unitsSkipped },
        errors: [],
      })
    } catch (e: any) {
      console.error('Error in import commit:', e)
      res.status(500).json({ error: 'Ошибка импорта: ' + (e?.message || 'неизвестная ошибка') })
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const item = await repo.findOne({
        where: { id: req.params.id },
        relations: ['rubric', 'publications'],
      })
      if (!item) return res.status(404).json({ error: 'Единица не найдена' })
      res.json(item)
    } catch (e) {
      console.error('Error fetching unit:', e)
      res.status(500).json({ error: 'Ошибка загрузки' })
    }
  },

  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.userId
      if (!userId) return res.status(401).json({ error: 'Не авторизован' })

      const body = req.body as Partial<ContentUnit>
      const item = repo.create({
        ...body,
        created_by: userId,
        title: body.title || (body.hook ? body.hook.slice(0, 80) : 'Без названия'),
      })
      const saved = await repo.save(item)
      const full = await repo.findOne({ where: { id: saved.id }, relations: ['rubric', 'publications'] })
      res.status(201).json(full)
    } catch (e) {
      console.error('Error creating unit:', e)
      res.status(500).json({ error: 'Ошибка создания' })
    }
  },

  async update(req: Request, res: Response) {
    try {
      const item = await repo.findOne({ where: { id: req.params.id } })
      if (!item) return res.status(404).json({ error: 'Единица не найдена' })
      await repo.update(req.params.id, req.body)
      const updated = await repo.findOne({
        where: { id: req.params.id },
        relations: ['rubric', 'publications'],
      })
      res.json(updated)
    } catch (e) {
      console.error('Error updating unit:', e)
      res.status(500).json({ error: 'Ошибка обновления' })
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const result = await repo.delete(req.params.id)
      if (result.affected === 0) return res.status(404).json({ error: 'Единица не найдена' })
      res.json({ message: 'Удалена' })
    } catch (e) {
      console.error('Error deleting unit:', e)
      res.status(500).json({ error: 'Ошибка удаления' })
    }
  },
}
