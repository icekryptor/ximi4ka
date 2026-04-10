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

router.post('/:id/dependencies', projectController.addDependency);
router.delete('/:id/dependencies/:depId', projectController.removeDependency);

router.get('/:id/export', projectController.exportProject);

export default router;
