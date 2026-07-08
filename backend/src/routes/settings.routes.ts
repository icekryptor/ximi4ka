import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';

const router = Router();

router.get('/integrations', settingsController.integrations);
router.put('/wb-token', settingsController.saveWbToken);
router.put('/ozon-creds', settingsController.saveOzonCreds);

export default router;
