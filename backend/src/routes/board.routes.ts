import { Router } from 'express';
import { boardController } from '../controllers/board.controller';
import { taskController } from '../controllers/task.controller';
import { taskTagController } from '../controllers/taskTag.controller';

const router = Router();

// Boards
router.get('/', boardController.getAll);
router.post('/', boardController.create);
router.put('/:id', boardController.update);
router.delete('/:id', boardController.archive);

// Tasks (nested under boards)
router.get('/:boardId/tasks', taskController.getAll);
router.post('/:boardId/tasks', taskController.create);
router.put('/:boardId/tasks/:id', taskController.update);
router.patch('/:boardId/tasks/:id/move', taskController.move);
router.delete('/:boardId/tasks/:id', taskController.delete);

// Tags (nested under boards)
router.get('/:boardId/tags', taskTagController.getAll);
router.post('/:boardId/tags', taskTagController.create);
router.delete('/:boardId/tags/:id', taskTagController.delete);

export default router;
