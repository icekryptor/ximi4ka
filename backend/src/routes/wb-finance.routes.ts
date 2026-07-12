import { Router } from 'express';
import {
  syncStats,
  getWeekly,
  getSyncStatus,
  getAnalytics,
  getArticles,
  getTokenStatus,
  saveToken,
} from '../controllers/wb-finance.controller';

const router = Router();

// Token
router.get('/token/status', getTokenStatus);
router.post('/token', saveToken);

// Sync
router.post('/sync', syncStats);
router.get('/sync-status', getSyncStatus);

// Analytics
router.get('/analytics', getAnalytics);
router.get('/weekly', getWeekly);
router.get('/articles', getArticles);

export default router;
