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

export type ContentType = 'short_video' | 'text_post' | 'other'

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

  @Column({ type: 'varchar', length: 20, default: 'short_video' })
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

  @OneToMany(() => ContentPublication, (p) => p.content_unit)
  publications: ContentPublication[]
}
