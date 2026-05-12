import { Router } from 'express'
import { channelBudgetController } from '../controllers/channel-budget.controller'

const router = Router()
router.get('/', channelBudgetController.getAll)
router.get('/:id', channelBudgetController.getById)
router.post('/', channelBudgetController.create)
router.put('/:id', channelBudgetController.update)
router.delete('/:id', channelBudgetController.delete)

export default router
