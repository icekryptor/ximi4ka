import type { ChannelPublisher } from './types'
import { telegramPublisher } from './telegram-publisher'

// Keyed by channel.platform. Append-only — new publishers added in their own commit.
const PUBLISHERS: Record<string, ChannelPublisher> = {
  telegram: telegramPublisher,
}

export function getPublisher(platform: string): ChannelPublisher | null {
  return PUBLISHERS[platform] ?? null
}

export function listSupportedPlatforms(): string[] {
  return Object.keys(PUBLISHERS)
}
