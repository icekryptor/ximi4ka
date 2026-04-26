import { Router } from 'express'
import multer from 'multer'
import { bankImportController } from '../controllers/bankImport.controller'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
})

const router = Router()
router.post('/preview', upload.single('file'), bankImportController.preview)
router.post('/commit', bankImportController.commit)
export default router
