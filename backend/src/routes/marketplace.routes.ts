import { Router } from 'express';
import multer from 'multer';
import { marketplaceController } from '../controllers/marketplace.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Sales CRUD
router.get('/sales', marketplaceController.getSales);
router.get('/sales/:id', marketplaceController.getSaleById);
router.post('/sales', marketplaceController.createSale);
router.put('/sales/:id', marketplaceController.updateSale);
router.delete('/sales/:id', marketplaceController.deleteSale);

// Import
router.post('/import', upload.single('file'), marketplaceController.importSales);
router.post('/import/confirm', marketplaceController.confirmImportSales);

// Analytics
router.get('/analytics/:marketplace', marketplaceController.getAnalytics);

// SKU Mappings
router.get('/sku-mappings', marketplaceController.getSkuMappings);
router.post('/sku-mappings', marketplaceController.createSkuMapping);
router.put('/sku-mappings/:id', marketplaceController.updateSkuMapping);
router.delete('/sku-mappings/:id', marketplaceController.deleteSkuMapping);

export default router;
