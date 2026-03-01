import { Router } from 'express';
import { financialReportController } from '../controllers/financial-report.controller';

const router = Router();

router.get('/cash-flow', financialReportController.getCashFlow);
router.get('/pnl', financialReportController.getPnl);
router.get('/balance', financialReportController.getBalance);

export default router;
