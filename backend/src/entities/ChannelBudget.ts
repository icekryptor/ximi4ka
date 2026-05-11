import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Channel } from './Channel'

@Entity('channel_budget')
export class ChannelBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  channel_id: string

  @ManyToOne(() => Channel, (c) => c.budgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel

  @Column({ type: 'date' })
  period_start: string

  @Column({ type: 'date' })
  period_end: string

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount_rub: string

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
