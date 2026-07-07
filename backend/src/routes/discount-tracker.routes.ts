import { Router } from 'express';
import { discountTrackerController } from '../controllers/discount-tracker.controller';

const router = Router();

// Фактическая СПП по заказам (основной источник)
router.get('/spp/daily', discountTrackerController.sppDaily);
router.get('/spp/orders', discountTrackerController.sppOrders);
router.post('/spp/sync', discountTrackerController.sppSync);

// Легаси — снапшоты витрины (скрейп отключён, историю оставили)
router.get('/latest', discountTrackerController.latest);
router.get('/hourly', discountTrackerController.hourly);
router.get('/history', discountTrackerController.history);
router.get('/alerts', discountTrackerController.alerts);

export default router;
