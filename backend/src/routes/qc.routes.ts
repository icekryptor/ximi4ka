import { Router } from 'express';
import { qcController } from '../controllers/qc.controller';

const router = Router();

// Статистика
router.get('/stats', qcController.stats);

// Чек-листы
router.get('/checklists', qcController.getAllChecklists);
router.get('/checklists/:id', qcController.getChecklistById);
router.post('/checklists', qcController.createChecklist);
router.put('/checklists/:id', qcController.updateChecklist);
router.delete('/checklists/:id', qcController.deleteChecklist);

// Проверки
router.get('/inspections', qcController.getAllInspections);
router.get('/inspections/:id', qcController.getInspectionById);
router.post('/inspections', qcController.createInspection);

export default router;
