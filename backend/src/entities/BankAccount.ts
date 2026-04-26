import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'varchar', length: 20 })
  bank_code: string

  @Column({ type: 'varchar', length: 30, nullable: true })
  account_number: string | null

  @Column({ type: 'varchar', length: 3, default: 'RUB' })
  currency: string

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  opening_balance: number

  @Column({ type: 'date', nullable: true })
  opening_date: string | null

  @Column({ type: 'boolean', default: true })
  is_active: boolean

  @CreateDateColumn() created_at: Date
  @UpdateDateColumn() updated_at: Date
}
