import { Router } from 'express';
import { channelPresetController } from '../controllers/channel-preset.controller';

const router = Router();

router.get('/', channelPresetController.getAll);
router.get('/:channelName', channelPresetController.getByChannel);
router.put('/:channelName', channelPresetController.upsert);

export default router;
