import { brandDocsApi } from './brandDocs'
import type { KrStatus } from '../lib/okr-parser'

const SLUG = 'okr_status'
const TITLE = 'OKR — статусы KR'

export interface KrStatusEntry {
  status: KrStatus
  comment?: string
  updated_at: string  // ISO
}

export interface OkrStatusDoc {
  version: number
  updated_at: string
  statuses: Record<string, KrStatusEntry>  // keyed by KR id ("Q2-2026-O1-KR1")
}

const EMPTY_DOC: OkrStatusDoc = {
  version: 1,
  updated_at: new Date(0).toISOString(),
  statuses: {},
}

export const okrStatusApi = {
  async load(): Promise<OkrStatusDoc> {
    const doc = await brandDocsApi.get(SLUG)
    if (!doc || !doc.content) return EMPTY_DOC
    try {
      const parsed = JSON.parse(doc.content) as OkrStatusDoc
      if (!parsed.statuses) return EMPTY_DOC
      return parsed
    } catch {
      return EMPTY_DOC
    }
  },

  /**
   * Upsert a single KR's status. Read-modify-write semantics; if two clients
   * race, last-writer-wins (acceptable for single-operator workflow).
   */
  async setKrStatus(krId: string, status: KrStatus, comment?: string): Promise<OkrStatusDoc> {
    const current = await this.load()
    const next: OkrStatusDoc = {
      version: 1,
      updated_at: new Date().toISOString(),
      statuses: {
        ...current.statuses,
        [krId]: {
          status,
          ...(comment !== undefined ? { comment } : {}),
          updated_at: new Date().toISOString(),
        },
      },
    }
    await brandDocsApi.upsert(SLUG, { title: TITLE, content: JSON.stringify(next, null, 2) })
    return next
  },

  /** Remove a KR's status (sets to unknown). */
  async clearKrStatus(krId: string): Promise<OkrStatusDoc> {
    const current = await this.load()
    const { [krId]: _unused, ...remaining } = current.statuses
    void _unused
    const next: OkrStatusDoc = {
      version: 1,
      updated_at: new Date().toISOString(),
      statuses: remaining,
    }
    await brandDocsApi.upsert(SLUG, { title: TITLE, content: JSON.stringify(next, null, 2) })
    return next
  },
}
