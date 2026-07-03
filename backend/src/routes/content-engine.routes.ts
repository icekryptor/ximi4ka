import { Router } from 'express'
import { contentEngineController } from '../controllers/content-engine.controller'

const router = Router()
router.get('/stats', contentEngineController.stats)
router.get('/blueprint', contentEngineController.blueprint)
export default router
