import { Router } from 'express';
import { telegramProjectAuth } from '../middleware/telegramAuth';
import { publicProjectController } from '../controllers/publicProject.controller';

const router = Router();

// All routes below require a valid Telegram JWT token in the ?token= query param.
// The middleware also resolves the caller's role (responsible | member).
router.use('/:id', telegramProjectAuth);

// Project-level
router.get('/:id', publicProjectController.getProject);
router.put('/:id', publicProjectController.updateProject);

// Tasks
router.post('/:id/tasks', publicProjectController.addTask);
router.patch('/:id/tasks/:taskId', publicProjectController.updateTask);

// Comments
router.get('/:id/tasks/:taskId/comments', publicProjectController.getComments);
router.post('/:id/tasks/:taskId/comments', publicProjectController.addComment);

// Checklist
router.patch('/:id/tasks/:taskId/checklist/:itemId', publicProjectController.updateChecklistItem);

// Members
router.post('/:id/members', publicProjectController.addMember);
router.delete('/:id/members/:memberId', publicProjectController.removeMember);

export default router;
