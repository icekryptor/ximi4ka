import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { BankAccount } from './BankAccount'

@Entity('bank_imports')
export class BankImport {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account: BankAccount | null

  @Column({ type: 'uuid', nullable: true })
  bank_account_id: string | null

  @Column({ type: 'varchar', length: 255 })
  file_name: string

  @Column({ type: 'date', nullable: true })
  period_start: string | null

  @Column({ type: 'date', nullable: true })
  period_end: string | null

  @Column({ type: 'integer', default: 0 })
  total_rows: number

  @Column({ type: 'integer', default: 0 })
  imported_rows: number

  @Column({ type: 'integer', default: 0 })
  skipped_duplicates: number

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string

  @Column({ type: 'text', nullable: true })
  error_message: string | null

  @Column({ type: 'uuid', nullable: true })
  imported_by: string | null

  @CreateDateColumn() created_at: Date
}
