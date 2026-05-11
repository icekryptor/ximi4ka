import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { ChannelBudget } from './ChannelBudget'

export type ChannelPlatform =
  | 'telegram'
  | 'tiktok'
  | 'reels'
  | 'youtube'
  | 'youtube_shorts'
  | 'vk'
  | 'x'
  | 'instagram'
  | 'yandex_zen'
  | 'site'
  | 'wb'
  | 'ozon'
  | 'email'
  | 'other'

export type ChannelIntegrationStatus = 'manual' | 'api_connected' | 'api_planned'

@Entity('channel')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 200 })
  display_name: string

  @Column({ type: 'varchar', length: 40 })
  platform: ChannelPlatform

  @Column({ type: 'varchar', length: 120, nullable: true })
  account_handle: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_url: string | null

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  integration_status: ChannelIntegrationStatus

  @Column({ type: 'boolean', default: true })
  active: boolean

  @Column({ type: 'jsonb', nullable: true })
  config_json: Record<string, unknown> | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ChannelBudget, (b) => b.channel)
  budgets: ChannelBudget[]
}
