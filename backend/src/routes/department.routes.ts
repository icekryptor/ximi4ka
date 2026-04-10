import { Router } from 'express';
import { departmentController } from '../controllers/department.controller';

const router = Router();

router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getOne);
router.get('/:id/members', departmentController.getMembers);
router.post('/:id/members', departmentController.addMember);
router.delete('/:id/members/:userId', departmentController.removeMember);
router.post('/:id/assign-board', departmentController.assignBoard);

export default router;
