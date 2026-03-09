import { Router } from 'express';
import { unitEconomicsController } from '../controllers/unitEconomics.controller';

const router = Router();

// Unit-экономика
router.get('/unit', unitEconomicsController.getAll);
router.get('/unit/:id', unitEconomicsController.getById);
router.post('/unit/calculate', unitEconomicsController.calculate);
router.delete('/unit/:id', unitEconomicsController.delete);

// Матрица маржинальности (все SKU × все каналы)
router.post('/margin/matrix', unitEconomicsController.marginMatrix);

export default router;
