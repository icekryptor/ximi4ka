import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('content_units')
export class ContentUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 500 })
  title: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 1000, nullable: true })
  material_url: string | null

  @Column({ type: 'date', nullable: true })
  youtube_date: string | null

  @Column({ type: 'date', nullable: true })
  instagram_date: string | null

  @Column({ type: 'date', nullable: true })
  tiktok_date: string | null

  @Column({ type: 'boolean', default: false })
  youtube_published: boolean

  @Column({ type: 'boolean', default: false })
  instagram_published: boolean

  @Column({ type: 'boolean', default: false })
  tiktok_published: boolean

  @Column({ type: 'varchar', length: 50, nullable: true })
  youtube_video_id: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  youtube_published_url: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  instagram_published_url: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  tiktok_published_url: string | null

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  publish_status: string

  @Column({ type: 'text', nullable: true })
  publish_error: string | null

  @Column({ type: 'text', nullable: true })
  tags: string | null

  @Column({ type: 'uuid' })
  created_by: string

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
