import { Router } from 'express';
import { supplyController } from '../controllers/supply.controller';

const router = Router();

router.get('/', supplyController.getAll);
router.get('/:id', supplyController.getById);
router.post('/', supplyController.create);
router.put('/:id', supplyController.update);
router.delete('/:id', supplyController.delete);

export default router;
