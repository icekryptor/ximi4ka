import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm'
import { BankAccount } from './BankAccount'
import { BankSyncLog } from './BankSyncLog'

export type BankSyncProvider = 'tochka' | 'ozon_email'

@Entity('bank_sync_config')
@Unique(['bank_account_id', 'provider'])
export class BankSyncConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  bank_account_id: string

  @ManyToOne(() => BankAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account: BankAccount

  @Column({ type: 'varchar', length: 40 })
  provider: BankSyncProvider

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'text', nullable: true })
  credentials_encrypted: string | null

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at: Date | null

  @Column({ type: 'date', nullable: true })
  last_period_end: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => BankSyncLog, (l) => l.bank_sync_config)
  logs: BankSyncLog[]
}
