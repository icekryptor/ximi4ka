// In-memory store for content-bank import preview tokens.
// TTL 5 min. Lost on backend restart — acceptable for low-traffic admin tool.

import { randomUUID } from 'crypto'

export interface ImportPlan {
  rubrics: Array<{
    slug: string
    title: string
    emoji: string | null
    tone: string | null
    audience: string | null
    cta_template: string | null
    sort_order: number
    existing_id: string | null
  }>
  units: Array<{
    incoming: Record<string, unknown>
    action: 'insert' | 'update' | 'skip'
    existing_id: string | null
    skip_reason?: string
  }>
  user_id: string
  created_at: number
}

const store = new Map<string, ImportPlan>()
const TTL_MS = 5 * 60 * 1000

export function saveImportPlan(plan: ImportPlan): string {
  const token = randomUUID()
  store.set(token, plan)
  // Cleanup expired entries opportunistically
  const now = Date.now()
  for (const [t, p] of store) {
    if (now - p.created_at > TTL_MS) store.delete(t)
  }
  return token
}

export function getImportPlan(token: string): ImportPlan | null {
  const plan = store.get(token)
  if (!plan) return null
  if (Date.now() - plan.created_at > TTL_MS) {
    store.delete(token)
    return null
  }
  return plan
}

export function deleteImportPlan(token: string) {
  store.delete(token)
}

// Periodic sweep: every minute, drop expired entries.
// `unref()` so this interval doesn't keep the process alive at shutdown.
const sweepInterval = setInterval(() => {
  const now = Date.now()
  for (const [t, p] of store) {
    if (now - p.created_at > TTL_MS) store.delete(t)
  }
}, 60_000)
sweepInterval.unref()
