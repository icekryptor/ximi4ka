import { Router } from 'express'
import multer from 'multer'
import { contentUnitController } from '../controllers/content-unit.controller'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — match bankImport.routes pattern
})

const router = Router()

router.get('/ungraded-count', contentUnitController.ungradedCount)
router.get('/rejected-count', contentUnitController.rejectedCount)
router.delete('/purge-rejected', contentUnitController.purgeRejected)
router.get('/export', contentUnitController.export)
router.post('/import/preview', upload.single('file'), contentUnitController.importPreview)
router.post('/import/commit', contentUnitController.importCommit)
router.get('/', contentUnitController.getAll)
router.get('/:id', contentUnitController.getOne)
router.post('/', contentUnitController.create)
router.put('/:id', contentUnitController.update)
router.delete('/:id', contentUnitController.delete)

export default router
