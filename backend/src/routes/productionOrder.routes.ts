import { Router } from 'express';
import { productionOrderController } from '../controllers/productionOrder.controller';

const router = Router();

router.get('/stats', productionOrderController.stats);
router.get('/', productionOrderController.getAll);
router.get('/:id', productionOrderController.getById);
router.post('/', productionOrderController.create);
router.put('/:id', productionOrderController.update);
router.patch('/:id/status', productionOrderController.updateStatus);
router.delete('/:id', productionOrderController.delete);

export default router;
