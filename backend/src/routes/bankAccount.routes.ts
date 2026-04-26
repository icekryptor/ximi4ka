import { Router } from 'express'
import { bankAccountController } from '../controllers/bankAccount.controller'

const router = Router()
router.get('/', bankAccountController.list)
router.post('/', bankAccountController.create)
router.put('/:id', bankAccountController.update)
router.delete('/:id', bankAccountController.remove)
export default router
