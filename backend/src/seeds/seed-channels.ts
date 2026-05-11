import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config()

import { AppDataSource } from '../config/database'
import { Channel, ChannelPlatform } from '../entities/Channel'

interface SeedChannel {
  slug: string
  display_name: string
  platform: ChannelPlatform
  account_handle?: string
  profile_url?: string
}

// Baseline set — adjust based on the DISTINCT query from Step 1.
// Slugs MUST match existing `content_publications.network` values
// for backfill in Task 12 to work.
const seeds: SeedChannel[] = [
  { slug: 'tiktok', display_name: 'TikTok', platform: 'tiktok' },
  { slug: 'reels', display_name: 'Instagram Reels', platform: 'reels' },
  { slug: 'youtube_shorts', display_name: 'YouTube Shorts', platform: 'youtube_shorts' },
  { slug: 'youtube', display_name: 'YouTube', platform: 'youtube' },
  { slug: 'telegram', display_name: 'Telegram (main)', platform: 'telegram' },
  { slug: 'vk', display_name: 'VK', platform: 'vk' },
  { slug: 'x', display_name: 'X (Twitter)', platform: 'x' },
  { slug: 'instagram', display_name: 'Instagram (feed)', platform: 'instagram' },
]

async function main() {
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(Channel)
  let created = 0
  let skipped = 0
  for (const s of seeds) {
    const existing = await repo.findOne({ where: { slug: s.slug } })
    if (existing) {
      skipped++
      continue
    }
    await repo.save(repo.create({
      slug: s.slug,
      display_name: s.display_name,
      platform: s.platform,
      account_handle: s.account_handle ?? null,
      profile_url: s.profile_url ?? null,
      integration_status: 'manual',
      active: true,
    }))
    created++
  }
  console.log(`Channels: created=${created} skipped=${skipped}`)
  await AppDataSource.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
