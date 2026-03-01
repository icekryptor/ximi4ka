import { Router } from 'express';
import multer from 'multer';
import { transactionController } from '../controllers/transaction.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', transactionController.getAll);

// Export/Import — BEFORE /:id to avoid route conflict
router.get('/export', transactionController.exportXlsx);
router.post('/import', upload.single('file'), transactionController.importXlsx);
router.post('/import/confirm', transactionController.confirmImport);

router.get('/:id', transactionController.getById);
router.post('/', transactionController.create);
router.put('/:id', transactionController.update);
router.delete('/:id', transactionController.delete);

export default router;
