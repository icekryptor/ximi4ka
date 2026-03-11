import { Router } from 'express';
import {
  getReport,
  getSummary,
  syncFromWb,
  createOrUpdate,
  deleteEntry,
  getEntries,
} from '../controllers/sales-report.controller';

const router = Router();

// Report (aggregated columnar format)
router.get('/', getReport);
router.get('/summary', getSummary);
router.get('/entries', getEntries);

// WB Sync
router.post('/sync-wb', syncFromWb);

// Manual CRUD
router.post('/', createOrUpdate);
router.delete('/:id', deleteEntry);

export default router;
