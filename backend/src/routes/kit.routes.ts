import { Router } from 'express';
import { kitController } from '../controllers/kit.controller';

const router = Router();

router.get('/', kitController.getAll);
router.get('/:id', kitController.getById);
router.get('/:id/calculate', kitController.calculateCost);
router.post('/', kitController.create);
router.post('/:id/components', kitController.addComponent);
router.put('/:id/components/:componentId', kitController.updateComponent);
router.delete('/:id/components/:componentId', kitController.removeComponent);
router.put('/:id', kitController.update);
router.delete('/:id', kitController.delete);

export default router;
