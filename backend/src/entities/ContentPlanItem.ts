import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('content_plan_item')
export class ContentPlanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'date', nullable: true })
  plan_date: string | null

  @Column({ type: 'varchar', length: 8, nullable: true })
  funnel_level: string | null // TOFU | MOFU | BOFU

  @Column({ type: 'uuid', nullable: true })
  segment_id: string | null

  @Column({ type: 'uuid', nullable: true })
  theme_id: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  format: string | null

  @Column({ type: 'text', nullable: true })
  goal: string | null

  @Column({ type: 'varchar', length: 20, default: 'planned' })
  status: string // planned | in_progress | published

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
