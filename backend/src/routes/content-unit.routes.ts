import { Router } from 'express'
import { contentUnitController } from '../controllers/content-unit.controller'

const router = Router()

router.get('/', contentUnitController.getAll)
router.post('/sync-yadisk', contentUnitController.syncYaDisk)
router.post('/export-sheets', contentUnitController.exportToSheets)
router.post('/:id/publish-youtube', contentUnitController.publishYouTube)
router.put('/:id/mark-published', contentUnitController.markPublished)
router.get('/:id', contentUnitController.getOne)
router.post('/', contentUnitController.create)
router.put('/:id', contentUnitController.update)
router.delete('/:id', contentUnitController.delete)

export default router
