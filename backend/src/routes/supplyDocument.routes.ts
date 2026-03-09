import { Router } from 'express';
import { supplyDocumentController, uploadDoc } from '../controllers/supplyDocument.controller';

const router = Router({ mergeParams: true }); // чтобы получить :supplyId из родительского роутера

router.get('/',        supplyDocumentController.getAll);
router.post('/',       uploadDoc.array('files', 20), supplyDocumentController.upload);
router.put('/:docId',  supplyDocumentController.update);
router.delete('/:docId', supplyDocumentController.delete);

export default router;
