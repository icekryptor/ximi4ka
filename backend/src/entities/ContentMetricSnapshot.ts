import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ContentPublication } from './ContentPublication'

export type MetricCapturedBy = 'worker' | 'manual'

@Entity('content_metric_snapshot')
export class ContentMetricSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  publication_id: string

  @ManyToOne(() => ContentPublication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publication_id' })
  publication: ContentPublication

  @CreateDateColumn({ type: 'timestamptz', name: 'captured_at' })
  captured_at: Date

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  captured_by: MetricCapturedBy

  @Column({ type: 'int', nullable: true })
  views: number | null

  @Column({ type: 'int', nullable: true })
  likes: number | null

  @Column({ type: 'int', nullable: true })
  comments: number | null

  @Column({ type: 'int', nullable: true })
  shares: number | null

  @Column({ type: 'int', nullable: true })
  saves: number | null

  @Column({ type: 'int', nullable: true })
  profile_clicks: number | null

  @Column({ type: 'int', nullable: true })
  marketplace_clicks: number | null

  @Column({ type: 'jsonb', nullable: true })
  raw_json: Record<string, unknown> | null
}
