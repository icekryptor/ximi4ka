import { Router } from 'express'
import { claudeController } from '../controllers/claude.controller'

const router = Router()

router.post('/generate', claudeController.generate)
router.post('/factcheck', claudeController.factcheck)
router.post('/style', claudeController.style)
router.post('/edit', claudeController.edit)
router.post('/edit-with-learning', claudeController.editWithLearning)
router.post('/preprocess', claudeController.preprocess)
router.post('/recipe-step', claudeController.recipeStep)

export default router
