import { Router } from 'express';
import { discountTrackerController } from '../controllers/discount-tracker.controller';

const router = Router();

router.get('/latest', discountTrackerController.latest);
router.get('/hourly', discountTrackerController.hourly);
router.get('/history', discountTrackerController.history);
router.get('/alerts', discountTrackerController.alerts);
router.post('/run', discountTrackerController.run);

export default router;
