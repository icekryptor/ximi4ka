import { Router } from 'express';
import { wbDashboardController } from '../controllers/wb-dashboard.controller';

const router = Router();
router.get('/wb', wbDashboardController.overview);

export default router;
