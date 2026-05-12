import type { ContentUnit } from '../../entities/ContentUnit'
import { isRecipeState } from '../recipe-engine'

export function extractPublishText(unit: ContentUnit): string {
  // If recipe state exists, we expect final to be ready — no silent fallback to title.
  if (isRecipeState(unit.recipe_state)) {
    const completedFinal = unit.recipe_state.steps.find(
      (s) => s.step_id === 'final' && s.status === 'completed',
    )
    if (completedFinal?.artifact_text?.trim()) return completedFinal.artifact_text.trim()
    const anyFinalWithText = unit.recipe_state.steps.find(
      (s) => s.step_id === 'final' && s.artifact_text?.trim(),
    )
    if (anyFinalWithText?.artifact_text?.trim()) return anyFinalWithText.artifact_text.trim()
    throw new Error(
      'Рецепт не завершён: шаг "final" не имеет готового текста. ' +
        'Завершите шаг или отключите авто-публикацию.',
    )
  }
  // No recipe — fallback to legacy fields
  const parts: string[] = []
  if (unit.title?.trim()) parts.push(unit.title.trim())
  if (unit.essence?.trim()) parts.push(unit.essence.trim())
  if (unit.notes?.trim()) parts.push(unit.notes.trim())
  if (parts.length === 0) {
    throw new Error('Нет текста для публикации: title, essence и notes пусты')
  }
  return parts.join('\n\n')
}
