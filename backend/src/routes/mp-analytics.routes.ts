import { Router } from 'express';
import { mpAnalyticsController } from '../controllers/mp-analytics.controller';

const router = Router();

router.get('/daily', mpAnalyticsController.daily);
router.get('/summary', mpAnalyticsController.summary);
router.get('/ads', mpAnalyticsController.ads);
router.get('/ads-detail', mpAnalyticsController.adsDetail);
router.get('/plan', mpAnalyticsController.plan);
router.put('/plan', mpAnalyticsController.planSave);
router.post('/sync', mpAnalyticsController.sync);
router.post('/import', mpAnalyticsController.import);
router.post('/ad-import', mpAnalyticsController.adImport);

export default router;
