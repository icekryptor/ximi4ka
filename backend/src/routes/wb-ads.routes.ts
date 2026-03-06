import { Router } from 'express';
import {
  syncStats,
  getSyncStatus,
  getAnalytics,
  getArticles,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getTokenStatus,
  saveToken,
} from '../controllers/wb-ads.controller';

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

// Notes CRUD
router.get('/notes', getNotes);
router.post('/notes', createNote);
router.put('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);

export default router;
