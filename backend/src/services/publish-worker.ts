/**
 * publish-worker — cron-driven processor for scheduled auto-publications.
 *
 * ## Concurrency model (v1)
 *
 * - **Same-process race protection:** `inFlight: Set<string>` mutex by publication.id
 *   prevents two cron ticks from picking up the same row. Cron interval (60s) >> typical
 *   publish duration (1-3s for Telegram), so contention is rare.
 *
 * - **Single-instance assumption:** Railway runs ONE backend instance. Multi-instance
 *   scale-out would require DB-level locks (e.g. `pg_try_advisory_lock`).
 *
 * - **Restart-during-publish hazard:** if the process is killed AFTER `bot.sendMessage`
 *   completes but BEFORE the `repo.update(published_at)` lands, the publication remains
 *   `published_at IS NULL` and the next tick will re-publish → DUPLICATE Telegram message.
 *
 *   Mitigation choices considered:
 *   - Write `published_at` BEFORE sending: inverts to "lost message on failure" mode.
 *     Rejected — worse UX (silent loss vs visible dup that operator can delete).
 *   - Add `claimed_at` column with TTL: hardens correctness at cost of one migration.
 *     Deferred to Phase E if duplicates become a real complaint.
 *   - Accept the risk: ✓ (current). Railway redeploys are infrequent; operator can
 *     delete the duplicate manually.
 */
import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'
import { getPublisher } from './publishers/registry'
import type { PublisherLog } from './publishers/types'
import { emptyPublisherLog } from './publishers/types'

const MAX_ATTEMPTS = 3
const inFlight = new Set<string>() // process-local mutex by publication.id

export async function tickPublishWorker(): Promise<void> {
  const repo = AppDataSource.getRepository(ContentPublication)
  const now = new Date()
  const candidates = await repo
    .createQueryBuilder('cp')
    .leftJoinAndSelect('cp.channel', 'channel')
    .leftJoinAndSelect('cp.content_unit', 'unit')
    .where('cp.auto_publish = :ap', { ap: true })
    .andWhere('cp.published_at IS NULL')
    .andWhere('cp.scheduled_at IS NOT NULL')
    .andWhere('cp.scheduled_at <= :now', { now })
    .andWhere('cp.channel_id IS NOT NULL')
    .orderBy('cp.scheduled_at', 'ASC')
    .limit(20)
    .getMany()

  for (const pub of candidates) {
    if (inFlight.has(pub.id)) continue
    inFlight.add(pub.id)
    try {
      await processPublication(pub)
    } catch (e) {
      console.error(`[publish-worker] ${pub.id} fatal:`, e)
    } finally {
      inFlight.delete(pub.id)
    }
  }
}

async function processPublication(pub: ContentPublication): Promise<void> {
  const repo = AppDataSource.getRepository(ContentPublication)
  const channel = pub.channel
  const unit = pub.content_unit
  if (!channel || !unit) return // shouldn't happen with the joins above

  const publisher = getPublisher(channel.platform)
  const prev = (pub.publisher_log as PublisherLog | null) ?? emptyPublisherLog()

  if (!publisher) {
    await repo.update(pub.id, {
      auto_publish: false,
      publisher_log: {
        ...prev,
        attempts: prev.attempts + 1,
        success: false,
        last_error: `Publisher для платформы "${channel.platform}" не зарегистрирован`,
        last_attempt_at: new Date().toISOString(),
        gave_up: true,
      } satisfies PublisherLog as unknown as Record<string, unknown> as any,
    })
    return
  }

  try {
    const result = await publisher.publish({ unit, channel, publication: pub })
    await repo.update(pub.id, {
      published_at: new Date(),
      published_url: result.published_url,
      publisher_log: {
        ...prev,
        attempts: prev.attempts + 1,
        success: true,
        last_error: null,
        last_attempt_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        gave_up: false,
        raw: result.raw_response,
      } satisfies PublisherLog as unknown as Record<string, unknown> as any,
    })
    console.log(`[publish-worker] ${pub.id} published to ${channel.slug}`)
  } catch (e: any) {
    const newAttempts = prev.attempts + 1
    const giveUp = newAttempts >= MAX_ATTEMPTS
    await repo.update(pub.id, {
      auto_publish: giveUp ? false : true,
      publisher_log: {
        ...prev,
        attempts: newAttempts,
        success: false,
        last_error: String(e?.message ?? e),
        last_attempt_at: new Date().toISOString(),
        gave_up: giveUp,
      } satisfies PublisherLog as unknown as Record<string, unknown> as any,
    })
    console.error(`[publish-worker] ${pub.id} attempt ${newAttempts} failed:`, e?.message ?? e)
  }
}

let _scheduled: ScheduledTask | null = null

/** Start the cron worker. Idempotent — safe to call multiple times. */
export function startPublishWorker(): void {
  if (_scheduled) return
  // Every minute. Catches up on missed schedule windows because we query by scheduled_at <= now().
  _scheduled = cron.schedule('* * * * *', () => {
    tickPublishWorker().catch((e) => console.error('[publish-worker] tick crashed:', e))
  })
  console.log('[publish-worker] started (cron: every minute)')
}

export function stopPublishWorker(): void {
  if (_scheduled) {
    _scheduled.stop()
    _scheduled = null
  }
}
