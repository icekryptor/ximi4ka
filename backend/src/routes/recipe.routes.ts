import { Router } from 'express'
import { recipeController } from '../controllers/recipe.controller'

const router = Router()
router.get('/', recipeController.list)
router.get('/:content_type', recipeController.getByType)

export default router
