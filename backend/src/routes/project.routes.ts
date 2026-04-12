import { Router } from 'express';
import { projectController } from '../controllers/project.controller';

const router = Router();

router.get('/', projectController.getAll);
router.get('/template', projectController.getTemplate);
router.post('/import', projectController.importProject);
router.get('/:id', projectController.getOne);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);

router.post('/:id/tasks', projectController.addTask);
router.put('/:id/tasks/:taskId', projectController.updateTask);

// Checklist
router.post('/:id/tasks/:taskId/checklist', projectController.addChecklistItem);
router.put('/:id/tasks/:taskId/checklist/:itemId', projectController.updateChecklistItem);
router.delete('/:id/tasks/:taskId/checklist/:itemId', projectController.deleteChecklistItem);

// Comments
router.get('/:id/tasks/:taskId/comments', projectController.getComments);
router.post('/:id/tasks/:taskId/comments', projectController.addComment);
router.delete('/:id/tasks/:taskId/comments/:commentId', projectController.deleteComment);

router.post('/:id/dependencies', projectController.addDependency);
router.delete('/:id/dependencies/:depId', projectController.removeDependency);

// Team members
router.get('/:id/members', projectController.getMembers);
router.post('/:id/members', projectController.addMember);
router.delete('/:id/members/:memberId', projectController.removeMember);

router.get('/:id/export', projectController.exportProject);

// Telegram settings
router.get('/:id/telegram', projectController.getTelegramSettings);
router.put('/:id/telegram', projectController.updateTelegramSettings);
router.delete('/:id/telegram', projectController.unlinkTelegram);
router.post('/:id/telegram/test', projectController.sendTelegramTest);

export default router;
