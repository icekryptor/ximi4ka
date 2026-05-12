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
