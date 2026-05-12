import { Router } from 'express'
import { icpSegmentController } from '../controllers/icp-segment.controller'

const router = Router()
router.get('/', icpSegmentController.getAll)
router.get('/:id', icpSegmentController.getById)
router.post('/', icpSegmentController.create)
router.put('/:id', icpSegmentController.update)
router.delete('/:id', icpSegmentController.delete)

export default router
