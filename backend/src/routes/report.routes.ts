import { Router } from 'express';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.get('/summary', reportController.getSummary);
router.get('/by-category', reportController.getByCategory);
router.get('/by-counterparty', reportController.getByCounterparty);

export default router;
