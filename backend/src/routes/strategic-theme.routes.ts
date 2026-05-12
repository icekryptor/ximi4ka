import { Router } from 'express'
import { strategicThemeController } from '../controllers/strategic-theme.controller'

const router = Router()
router.get('/', strategicThemeController.getAll)
router.get('/:id', strategicThemeController.getById)
router.post('/', strategicThemeController.create)
router.put('/:id', strategicThemeController.update)
router.delete('/:id', strategicThemeController.delete)

export default router
