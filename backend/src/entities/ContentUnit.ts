import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm'
import { ContentRubric } from './ContentRubric'
import { ContentPublication } from './ContentPublication'
import { IcpSegment } from './IcpSegment'
import { StrategicTheme } from './StrategicTheme'
import { ContentAsset } from './ContentAsset'

export type ContentType =
  | 'short_video'
  | 'long_video'
  | 'stream'
  | 'podcast'
  | 'short_post'
  | 'long_post'
  | 'carousel'
  | 'seo_article'
  | 'email_newsletter'
  | 'lead_magnet_pdf'
  | 'marketplace_card'
  | 'ad_creative'
  // legacy values — kept for backfill compatibility, do not use for new units
  | 'text_post'
  | 'other'

export type ContentStatus =
  | 'idea'
  | 'script'
  | 'filming'
  | 'editing'
  | 'ready'
  | 'published'
  | 'rejected'

export type ReviewGrade = 'excellent' | 'needs_work' | 'rejected'

@Entity('content_units')
export class ContentUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', nullable: true })
  rubric_id: string | null

  @ManyToOne(() => ContentRubric, (r) => r.units, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rubric_id' })
  rubric: ContentRubric | null

  @Column({ type: 'varchar', length: 40, default: 'short_video' })
  content_type: ContentType

  @Column({ type: 'varchar', length: 20, default: 'idea' })
  status: ContentStatus

  @Column({ type: 'smallint', nullable: true })
  complexity: number | null

  @Column({ type: 'varchar', length: 500 })
  title: string

  @Column({ type: 'text', nullable: true })
  hook: string | null

  @Column({ type: 'text', nullable: true })
  hook_ab: string | null

  @Column({ type: 'text', nullable: true })
  visual: string | null

  @Column({ type: 'text', nullable: true })
  essence: string | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'varchar', length: 1000, nullable: true })
  video_url: string | null

  @Column({ type: 'varchar', length: 20, nullable: true })
  review_grade: ReviewGrade | null

  @Column({ type: 'text', nullable: true })
  review_feedback: string | null

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null

  @Column({ type: 'text', nullable: true })
  script_text: string | null

  @Column({ type: 'text', nullable: true })
  video_brief: string | null

  @Column({ type: 'text', nullable: true })
  voiceover_text: string | null

  @Column({ type: 'timestamptz', nullable: true })
  ready_at: Date | null

  @Column({ type: 'uuid' })
  created_by: string

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @Column({ type: 'uuid', nullable: true })
  target_segment_id: string | null

  @ManyToOne(() => IcpSegment, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_segment_id' })
  target_segment: IcpSegment | null

  @Column({ type: 'uuid', nullable: true })
  theme_id: string | null

  @ManyToOne(() => StrategicTheme, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'theme_id' })
  theme: StrategicTheme | null

  @Column({ type: 'jsonb', nullable: true })
  recipe_state: Record<string, unknown> | null

  @Column({ type: 'timestamptz', nullable: true })
  production_started_at: Date | null

  @OneToMany(() => ContentAsset, (a) => a.content_unit)
  assets: ContentAsset[]

  @OneToMany(() => ContentPublication, (p) => p.content_unit)
  publications: ContentPublication[]
}
