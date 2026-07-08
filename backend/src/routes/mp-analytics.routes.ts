import { Router } from 'express';
import { mpAnalyticsController } from '../controllers/mp-analytics.controller';

const router = Router();

router.get('/daily', mpAnalyticsController.daily);
router.get('/summary', mpAnalyticsController.summary);
router.get('/ads', mpAnalyticsController.ads);
router.post('/sync', mpAnalyticsController.sync);
router.post('/import', mpAnalyticsController.import);
router.post('/ad-import', mpAnalyticsController.adImport);

export default router;
