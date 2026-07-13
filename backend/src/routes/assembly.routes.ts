import { Router } from 'express';
import { assemblyController } from '../controllers/assembly.controller';

const router = Router();

router.get('/roots', assemblyController.roots);
router.get('/tree', assemblyController.tree);
router.get('/operations', assemblyController.listOperations);
router.post('/operations', assemblyController.createOperation);
router.put('/operations/:id', assemblyController.updateOperation);
router.delete('/operations/:id', assemblyController.deleteOperation);
router.get('/settings/labor-rate', assemblyController.getLaborRate);
router.put('/settings/labor-rate', assemblyController.setLaborRate);

export default router;
