import { Router } from 'express';
import {
  syncStats,
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
router.get('/articles', getArticles);

export default router;
