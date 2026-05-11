import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'

export type ContentAssetKind =
  | 'image'
  | 'audio'
  | 'pdf'
  | 'video_external'
  | 'published_url'
  | 'script_text'
  | 'other'

export type ContentAssetStorage = 'supabase' | 'external'

@Entity('content_asset')
export class ContentAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  content_unit_id: string

  @ManyToOne(() => ContentUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_unit_id' })
  content_unit: ContentUnit

  @Column({ type: 'varchar', length: 80, nullable: true })
  recipe_step_id: string | null

  @Column({ type: 'varchar', length: 40 })
  kind: ContentAssetKind

  @Column({ type: 'varchar', length: 20 })
  storage: ContentAssetStorage

  @Column({ type: 'text' })
  path_or_url: string

  @Column({ type: 'bigint', nullable: true })
  size_bytes: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  mime: string | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  provider_hint: string | null

  @Column({ type: 'int', default: 1 })
  version: number

  @Column({ type: 'uuid', nullable: true })
  superseded_by: string | null

  @CreateDateColumn()
  created_at: Date

  @Column({ type: 'varchar', length: 120, nullable: true })
  created_by: string | null
}
