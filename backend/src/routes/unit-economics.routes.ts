import { Router } from 'express';
import { unitEconomicsController } from '../controllers/unit-economics.controller';

const router = Router();

router.get('/', unitEconomicsController.getAll);
router.get('/:id', unitEconomicsController.getById);
router.post('/', unitEconomicsController.create);
router.post('/:id/clone', unitEconomicsController.clone);
router.put('/:id', unitEconomicsController.update);
router.delete('/:id', unitEconomicsController.delete);

export default router;
