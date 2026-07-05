import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm'

@Entity('style_pattern')
export class StylePattern {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 50 })
  format: string // content_type (short_post, ...)

  @Column({ type: 'varchar', length: 16 })
  code: string // А11 | С10 | Э8 ...

  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ name: 'before', type: 'text', nullable: true })
  before: string | null // «как НЕ надо»

  @Column({ name: 'after', type: 'text', nullable: true })
  after: string | null // «как надо»

  @Column({ type: 'text' })
  rationale: string

  @Column({ type: 'text', nullable: true })
  source_note: string | null // контекст правки (откуда правило)

  @CreateDateColumn()
  created_at: Date
}
