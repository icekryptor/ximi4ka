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

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
