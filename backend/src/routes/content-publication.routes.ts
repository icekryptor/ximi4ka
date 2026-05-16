import { Router } from 'express'
import { contentPublicationController } from '../controllers/content-publication.controller'

const router = Router()

router.get('/today', contentPublicationController.todayList)
router.post('/', contentPublicationController.create)
router.put('/:id', contentPublicationController.update)
router.delete('/:id', contentPublicationController.delete)
router.post('/:id/publish-now', contentPublicationController.publishNow)

export default router
