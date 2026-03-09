import { Router } from 'express';
import { salesChannelController } from '../controllers/salesChannel.controller';

const router = Router();

router.get('/', salesChannelController.getAll);
router.get('/:id', salesChannelController.getById);
router.post('/', salesChannelController.create);
router.put('/:id', salesChannelController.update);
router.delete('/:id', salesChannelController.delete);

export default router;
