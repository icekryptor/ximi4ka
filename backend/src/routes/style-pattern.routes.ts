import { Router } from 'express'
import { stylePatternController } from '../controllers/style-pattern.controller'

const router = Router()
router.get('/', stylePatternController.list)
export default router
