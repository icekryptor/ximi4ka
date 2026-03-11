import { Router } from 'express';
import { employeeController, uploadPhoto } from '../controllers/employee.controller';

const router = Router();

router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', uploadPhoto.single('photo'), employeeController.create);
router.put('/:id', uploadPhoto.single('photo'), employeeController.update);
router.delete('/:id', employeeController.delete);

export default router;
