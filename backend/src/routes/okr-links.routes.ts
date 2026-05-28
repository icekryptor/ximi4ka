import { Router } from 'express'
import { okrLinksController } from '../controllers/okr-links.controller'

const router = Router()

router.get('/counts', okrLinksController.counts)

export default router
