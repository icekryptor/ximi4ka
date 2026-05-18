import { Router } from 'express'
import { bankSyncController } from '../controllers/bank-sync.controller'

const router = Router()

router.get('/logs', bankSyncController.listLogs)
router.get('/configs', bankSyncController.list)
router.post('/configs', bankSyncController.create)
router.put('/configs/:id', bankSyncController.update)
router.delete('/configs/:id', bankSyncController.delete)
router.post('/configs/:id/run', bankSyncController.run)

export default router
