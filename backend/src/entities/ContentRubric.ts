import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { ContentUnit } from './ContentUnit'

@Entity('content_rubrics')
export class ContentRubric {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'varchar', length: 8, nullable: true })
  emoji: string | null

  @Column({ type: 'text', nullable: true })
  tone: string | null

  @Column({ type: 'text', nullable: true })
  audience: string | null

  @Column({ type: 'text', nullable: true })
  cta_template: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ContentUnit, (u) => u.rubric)
  units: ContentUnit[]
}
