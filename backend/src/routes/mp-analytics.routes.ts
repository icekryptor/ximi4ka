import { Router } from 'express';
import { mpAnalyticsController } from '../controllers/mp-analytics.controller';
import { memoryUpload } from '../utils/supabaseStorage';

const router = Router();
const upload = memoryUpload({ fileSize: 20 * 1024 * 1024 }); // xlsx/csv ≤20MB в RAM

router.get('/daily', mpAnalyticsController.daily);
router.get('/summary', mpAnalyticsController.summary);
router.get('/ads', mpAnalyticsController.ads);
router.get('/ads-detail', mpAnalyticsController.adsDetail);
router.get('/plan', mpAnalyticsController.plan);
router.put('/plan', mpAnalyticsController.planSave);
router.get('/agent-digest', mpAnalyticsController.agentDigest);
router.post('/sync', mpAnalyticsController.sync);
router.post('/import', mpAnalyticsController.import);
router.post('/ad-import', mpAnalyticsController.adImport);
router.post('/ad-sync', mpAnalyticsController.adSync);
router.post('/upload', upload.single('file'), mpAnalyticsController.upload);
router.get('/wb-ad-diag', mpAnalyticsController.wbAdDiag);

export default router;
