import { Router } from 'express';
import { counterpartyController } from '../controllers/counterparty.controller';

const router = Router();

router.get('/', counterpartyController.getAll);
router.get('/:id', counterpartyController.getById);
router.post('/', counterpartyController.create);
router.put('/:id', counterpartyController.update);
router.delete('/:id', counterpartyController.delete);

export default router;
