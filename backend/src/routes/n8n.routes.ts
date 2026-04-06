import { Router } from 'express'
import { contentUnitController } from '../controllers/content-unit.controller'

const router = Router()

// GET /api/n8n/content-units/pending?platform=instagram
router.get('/content-units/pending', contentUnitController.getPending)

// PUT /api/n8n/content-units/:id/mark-published
router.put('/content-units/:id/mark-published', contentUnitController.markPublished)

export default router
