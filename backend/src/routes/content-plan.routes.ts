import { Router } from 'express';
import { contentPlanController } from '../controllers/content-plan.controller';

const router = Router();

router.get('/', contentPlanController.get);
router.post('/items', contentPlanController.createItem);
router.put('/items/:id', contentPlanController.updateItem);
router.delete('/items/:id', contentPlanController.deleteItem);

export default router;
