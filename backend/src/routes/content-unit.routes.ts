import { Router } from 'express'
import { contentUnitController } from '../controllers/content-unit.controller'

const router = Router()

router.get('/ungraded-count', contentUnitController.ungradedCount)
router.get('/', contentUnitController.getAll)
router.get('/:id', contentUnitController.getOne)
router.post('/', contentUnitController.create)
router.put('/:id', contentUnitController.update)
router.delete('/:id', contentUnitController.delete)

export default router
