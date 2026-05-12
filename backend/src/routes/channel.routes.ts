import { Router } from 'express'
import { channelController } from '../controllers/channel.controller'

const router = Router()
router.get('/', channelController.getAll)
router.get('/:id', channelController.getById)
router.post('/', channelController.create)
router.put('/:id', channelController.update)
router.delete('/:id', channelController.delete)

export default router
