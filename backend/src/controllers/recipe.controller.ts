import { Request, Response } from 'express'
import { recipeEngine } from '../services/recipe-engine'

export const recipeController = {
  list(_req: Request, res: Response) {
    res.json(recipeEngine.list())
  },

  getByType(req: Request, res: Response) {
    const { content_type } = req.params
    const recipe = recipeEngine.get(content_type)
    if (!recipe) {
      return res.status(404).json({ error: 'Рецепт для этого типа контента не найден' })
    }
    res.json(recipe)
  },
}
