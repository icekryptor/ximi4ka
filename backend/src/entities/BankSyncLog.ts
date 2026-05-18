import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { BankSyncConfig } from './BankSyncConfig'

export type BankSyncStatus = 'running' | 'success' | 'partial' | 'failed'

@Entity('bank_sync_log')
@Index(['bank_sync_config_id', 'started_at'])
export class BankSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  bank_sync_config_id: string

  @ManyToOne(() => BankSyncConfig, (c) => c.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bank_sync_config_id' })
  bank_sync_config: BankSyncConfig

  @Column({ type: 'timestamptz', default: () => 'now()' })
  started_at: Date

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: BankSyncStatus

  @Column({ type: 'date', nullable: true })
  period_start: string | null

  @Column({ type: 'date', nullable: true })
  period_end: string | null

  @Column({ type: 'integer', default: 0 })
  rows_fetched: number

  @Column({ type: 'integer', default: 0 })
  rows_imported: number

  @Column({ type: 'integer', default: 0 })
  rows_skipped_dup: number

  @Column({ type: 'integer', default: 0 })
  rows_pending_review: number

  @Column({ type: 'text', nullable: true })
  error_message: string | null
}
