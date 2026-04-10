import { Router } from 'express';
import { recurringTaskController } from '../controllers/recurringTask.controller';

const router = Router();

router.get('/', recurringTaskController.getAll);
router.get('/:id', recurringTaskController.getOne);
router.post('/', recurringTaskController.create);
router.put('/:id', recurringTaskController.update);
router.delete('/:id', recurringTaskController.delete);
router.post('/:id/reports', recurringTaskController.submitReport);
router.get('/:id/reports', recurringTaskController.getReports);

export default router;
