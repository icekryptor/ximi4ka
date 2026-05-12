import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { AppDataSource } from '../config/database'
import { ContentPublication } from '../entities/ContentPublication'
import { getPublisher } from './publishers/registry'

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
  const attempts = (pub.publisher_log as any)?.attempts ?? 0

  if (!publisher) {
    await repo.update(pub.id, {
      auto_publish: false,
      publisher_log: {
        ...((pub.publisher_log as any) || {}),
        last_error: `Publisher для платформы "${channel.platform}" не зарегистрирован`,
        attempts,
        last_attempt_at: new Date().toISOString(),
      } as any,
    })
    return
  }

  try {
    const result = await publisher.publish({ unit, channel, publication: pub })
    await repo.update(pub.id, {
      published_at: new Date(),
      published_url: result.published_url,
      publisher_log: {
        ...((pub.publisher_log as any) || {}),
        success: true,
        attempts: attempts + 1,
        completed_at: new Date().toISOString(),
        raw: result.raw_response,
      } as any,
    })
    console.log(`[publish-worker] ${pub.id} published to ${channel.slug}`)
  } catch (e: any) {
    const newAttempts = attempts + 1
    const giveUp = newAttempts >= MAX_ATTEMPTS
    await repo.update(pub.id, {
      auto_publish: giveUp ? false : true,
      publisher_log: {
        ...((pub.publisher_log as any) || {}),
        last_error: String(e?.message ?? e),
        attempts: newAttempts,
        last_attempt_at: new Date().toISOString(),
        gave_up: giveUp,
      } as any,
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
