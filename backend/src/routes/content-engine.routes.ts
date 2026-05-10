import { Router } from 'express'
import { contentEngineController } from '../controllers/content-engine.controller'

const router = Router()
router.get('/stats', contentEngineController.stats)
export default router
