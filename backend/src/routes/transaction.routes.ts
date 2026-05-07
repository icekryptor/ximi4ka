import { Router } from 'express';
import multer from 'multer';
import { transactionController } from '../controllers/transaction.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', transactionController.getAll);

// Auto-distribute uncategorized transactions through ImportRule engine — BEFORE /:id
router.get('/uncategorized-count', transactionController.getUncategorizedCount);
router.post('/auto-distribute', transactionController.autoDistribute);

// Export/Import — BEFORE /:id to avoid route conflict
router.get('/export', transactionController.exportXlsx);
router.post('/import', upload.single('file'), transactionController.importXlsx);
router.post('/import/confirm', transactionController.confirmImport);

// Inter-account transfer linking — BEFORE generic /:id routes
router.get('/:id/transfer-candidates', transactionController.transferCandidates);
router.post('/:id/mark-transfer', transactionController.markAsTransfer);
router.post('/:id/unmark-transfer', transactionController.unmarkTransfer);

router.get('/:id', transactionController.getById);
router.post('/', transactionController.create);
router.put('/:id', transactionController.update);
router.delete('/:id', transactionController.delete);

export default router;
