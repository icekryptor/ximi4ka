import type { ContentUnit } from '../../entities/ContentUnit'
import { isRecipeState } from '../recipe-engine'

export function extractPublishText(unit: ContentUnit): string {
  // Prefer recipe's final step text
  if (isRecipeState(unit.recipe_state)) {
    const completedFinal = unit.recipe_state.steps.find(
      (s) => s.step_id === 'final' && s.status === 'completed',
    )
    if (completedFinal?.artifact_text?.trim()) return completedFinal.artifact_text.trim()
    const anyFinal = unit.recipe_state.steps.find((s) => s.step_id === 'final')
    if (anyFinal?.artifact_text?.trim()) return anyFinal.artifact_text.trim()
  }
  // Fallback for non-recipe types or empty recipe state
  const parts: string[] = []
  if (unit.title?.trim()) parts.push(unit.title.trim())
  if (unit.essence?.trim()) parts.push(unit.essence.trim())
  if (unit.notes?.trim()) parts.push(unit.notes.trim())
  return parts.join('\n\n') || '(пусто)'
}
