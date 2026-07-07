import { Router } from 'express';
import { mpAnalyticsController } from '../controllers/mp-analytics.controller';

const router = Router();

router.get('/daily', mpAnalyticsController.daily);
router.get('/summary', mpAnalyticsController.summary);
router.post('/sync', mpAnalyticsController.sync);
router.post('/import', mpAnalyticsController.import);

export default router;
