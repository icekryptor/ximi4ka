import { Router } from 'express';
import { projectController } from '../controllers/project.controller';

const router = Router();

router.get('/', projectController.getAll);
router.get('/:id', projectController.getOne);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);

router.post('/:id/tasks', projectController.addTask);
router.put('/:id/tasks/:taskId', projectController.updateTask);

router.post('/:id/dependencies', projectController.addDependency);
router.delete('/:id/dependencies/:depId', projectController.removeDependency);

export default router;
