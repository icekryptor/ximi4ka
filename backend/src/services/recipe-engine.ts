import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export type ExecutorType = 'self' | 'ai_agent' | 'contractor'
export type ArtifactKind = 'text' | 'script_text' | 'image' | 'audio' | 'video_external' | 'pdf' | 'other'

export interface RecipeStep {
  id: string
  display_name: string
  artifact_kind: ArtifactKind
  default_executor: ExecutorType
  ai_assist_key: string | null
  description: string
}

export interface Recipe {
  content_type: string
  display_name: string
  description: string
  steps: RecipeStep[]
}

const RECIPES_DIR = path.join(__dirname, '..', 'content', 'recipes')

let cache: Map<string, Recipe> | null = null

function loadAll(): Map<string, Recipe> {
  const map = new Map<string, Recipe>()
  if (!fs.existsSync(RECIPES_DIR)) {
    console.error(`[recipe-engine] directory not found: ${RECIPES_DIR} — check build copies src/content to dist/content`)
    return map
  }
  for (const file of fs.readdirSync(RECIPES_DIR)) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue
    const full = path.join(RECIPES_DIR, file)
    try {
      const raw = fs.readFileSync(full, 'utf-8')
      const doc = yaml.load(raw) as Recipe
      if (!doc || typeof doc !== 'object') {
        console.error(`[recipe-engine] ${file}: empty or non-object YAML`)
        continue
      }
      if (!doc.content_type || !Array.isArray(doc.steps)) {
        console.error(`[recipe-engine] ${file}: missing content_type or steps`)
        continue
      }
      map.set(doc.content_type, doc)
      console.log(`[recipe-engine] loaded ${doc.content_type} (${doc.steps.length} steps) from ${file}`)
    } catch (e) {
      console.error(`[recipe-engine] failed to load ${file}:`, e)
    }
  }
  return map
}

// Synchronous lazy init — relies on fs.readFileSync / yaml.load being sync.
// Do NOT change to async fs.promises without converting cache to Promise<Map>.
function getCache(): Map<string, Recipe> {
  if (!cache) cache = loadAll()
  return cache
}

export const recipeEngine = {
  list(): Recipe[] {
    return Array.from(getCache().values())
  },
  get(contentType: string): Recipe | null {
    return getCache().get(contentType) ?? null
  },
  has(contentType: string): boolean {
    return getCache().has(contentType)
  },
  /**
   * Initial recipe_state for a unit of given content_type.
   * Returns null if no recipe exists for the type.
   */
  initialState(contentType: string): RecipeState | null {
    const recipe = this.get(contentType)
    if (!recipe) return null
    return {
      version: 1,
      recipe_content_type: recipe.content_type,
      started_at: new Date().toISOString(),
      steps: recipe.steps.map((s) => ({
        step_id: s.id,
        status: 'pending' as const,
        executor_type: s.default_executor,
        artifact_text: null,
        artifact_asset_id: null,
        ai_run_count: 0,
        completed_at: null,
      })),
    }
  },
  /** Force reload from disk (for dev hot-reload). Not exposed via API on v1. */
  reload(): void {
    cache = null
    getCache()
  },
}

export type RecipeStepStatus = 'pending' | 'in_progress' | 'awaiting_review' | 'completed' | 'skipped'

export interface RecipeStepState {
  step_id: string
  status: RecipeStepStatus
  executor_type: ExecutorType
  artifact_text: string | null
  artifact_asset_id: string | null
  ai_run_count: number
  completed_at: string | null
}

export interface RecipeState {
  version: 1
  recipe_content_type: string
  started_at: string
  steps: RecipeStepState[]
}

/**
 * Runtime type guard for recipe_state JSONB read from DB.
 * Use when treating `unit.recipe_state` (typed Record<string, unknown> | null by TypeORM)
 * as a structured RecipeState.
 */
export function isRecipeState(v: unknown): v is RecipeState {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.recipe_content_type === 'string' &&
    Array.isArray(o.steps)
  )
}
