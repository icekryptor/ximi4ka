import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'
import { Channel } from './Channel'

@Entity('content_publications')
@Unique(['content_unit_id', 'network'])
export class ContentPublication {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  content_unit_id: string

  @ManyToOne(() => ContentUnit, (u) => u.publications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_unit_id' })
  content_unit: ContentUnit

  @Column({ type: 'varchar', length: 50 })
  network: string

  @Column({ type: 'uuid', nullable: true })
  channel_id: string | null

  @ManyToOne(() => Channel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel | null

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null

  @Column({ type: 'varchar', length: 1000, nullable: true })
  published_url: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @Column({ type: 'boolean', default: false })
  auto_publish: boolean

  @Column({ type: 'jsonb', nullable: true })
  publisher_log: Record<string, unknown> | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
