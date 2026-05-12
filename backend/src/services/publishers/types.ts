import type { ContentUnit } from '../../entities/ContentUnit'
import type { Channel } from '../../entities/Channel'
import type { ContentPublication } from '../../entities/ContentPublication'

export interface PublishContext {
  unit: ContentUnit
  channel: Channel
  publication: ContentPublication
}

export interface PublishResult {
  published_url: string | null
  raw_response: unknown
}

export interface ChannelPublisher {
  canPublish(ctx: PublishContext): boolean
  publish(ctx: PublishContext): Promise<PublishResult>
}

export interface PublisherLog {
  attempts: number
  success: boolean
  last_error: string | null
  last_attempt_at: string | null
  completed_at: string | null
  gave_up: boolean
  manual: boolean
  raw: unknown
}

export function emptyPublisherLog(): PublisherLog {
  return {
    attempts: 0,
    success: false,
    last_error: null,
    last_attempt_at: null,
    completed_at: null,
    gave_up: false,
    manual: false,
    raw: null,
  }
}
