import { Router } from 'express'
import { brandDocController } from '../controllers/brand-doc.controller'

const router = Router()

router.get('/', brandDocController.getAll)
router.get('/:slug', brandDocController.getBySlug)
router.put('/:slug', brandDocController.upsert)

export default router
