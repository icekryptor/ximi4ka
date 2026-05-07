import { Router } from 'express'
import { contentRubricController } from '../controllers/content-rubric.controller'

const router = Router()

router.get('/', contentRubricController.getAll)
router.get('/:id', contentRubricController.getOne)
router.post('/', contentRubricController.create)
router.put('/:id', contentRubricController.update)
router.delete('/:id', contentRubricController.delete)

export default router
