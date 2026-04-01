import { Router } from 'express';
import { taskCommentController, uploadAttachment } from '../controllers/taskComment.controller';

const router = Router();

router.get('/:taskId/comments', taskCommentController.getAll);
router.post('/:taskId/comments', uploadAttachment.single('file'), taskCommentController.create);
router.delete('/:taskId/comments/:id', taskCommentController.delete);

export default router;
