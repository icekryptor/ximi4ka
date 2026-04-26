import { Router } from 'express'
import { importRuleController } from '../controllers/importRule.controller'
const router = Router()
router.get('/', importRuleController.list)
router.delete('/:id', importRuleController.remove)
export default router
