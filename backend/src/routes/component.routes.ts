import { Router } from 'express';
import { componentController } from '../controllers/component.controller';

const router = Router();

router.get('/', componentController.getAll);
router.get('/:id', componentController.getById);
router.post('/', componentController.create);
router.post('/bulk-import', componentController.bulkImport);
router.put('/:id', componentController.update);
router.delete('/:id', componentController.delete);

export default router;
