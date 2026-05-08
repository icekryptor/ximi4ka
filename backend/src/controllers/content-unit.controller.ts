import { Request, Response } from 'express'
import { IsNull } from 'typeorm'
import { AppDataSource } from '../config/database'
import { ContentUnit } from '../entities/ContentUnit'

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

      const qb = repo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.rubric', 'r')
        .leftJoinAndSelect('u.publications', 'p')

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
      if (sort === 'title') qb.orderBy('u.title', 'ASC')
      else if (sort === 'status') qb.orderBy('u.status', 'ASC').addOrderBy('u.created_at', 'DESC')
      else qb.orderBy('u.created_at', 'DESC')

      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()

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
