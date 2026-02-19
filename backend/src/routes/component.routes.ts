import { Router } from 'express';
import { componentController, upload } from '../controllers/component.controller';

const router = Router();

router.get('/', componentController.getAll);
router.get('/:id', componentController.getById);
router.post('/', componentController.create);
router.post('/bulk-import', componentController.bulkImport);
router.post('/:id/image', upload.single('image'), componentController.uploadImage);
router.put('/:id', componentController.update);
router.delete('/:id', componentController.delete);

// Состав сложного компонента
router.get('/:id/parts', componentController.getParts);
router.post('/:id/parts', componentController.addPart);
router.put('/:id/parts/:partEntryId', componentController.updatePart);
router.delete('/:id/parts/:partEntryId', componentController.removePart);

export default router;
