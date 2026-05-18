import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Counterparty } from './Counterparty';
import { Category } from './Category';
import { BankAccount } from './BankAccount';
import { BankImport } from './BankImport';

export enum TransactionType {
  INCOME = 'income',    // Доход
  EXPENSE = 'expense'   // Расход
}

export enum TransactionSource {
  MANUAL = 'manual',
  SUPPLY = 'supply',
  IMPORT = 'import'
}

@Entity('transactions')
@Index(['date'])
@Index(['type'])
@Index(['category_id'])
@Index(['counterparty_id'])
@Index(['source', 'source_id'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TransactionType,
    comment: 'Тип транзакции: доход или расход'
  })
  type: TransactionType;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Сумма' })
  amount: number;

  @Column({ type: 'varchar', length: 500, comment: 'Описание транзакции' })
  description: string;

  @Column({ type: 'date', comment: 'Дата транзакции' })
  date: Date;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ nullable: true })
  category_id: string;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'counterparty_id' })
  counterparty: Counterparty;

  @Column({ nullable: true })
  counterparty_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Номер документа' })
  document_number: string;

  @Column({ type: 'text', nullable: true, comment: 'Дополнительные заметки' })
  notes: string;

  @Column({ type: 'varchar', length: 20, default: TransactionSource.MANUAL, comment: 'Источник: manual, supply, import' })
  source: TransactionSource;

  @Column({ type: 'uuid', nullable: true, comment: 'ID источника (supply_id и т.д.)' })
  source_id: string;

  @ManyToOne(() => BankAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bank_account: BankAccount | null;

  @Column({ type: 'uuid', nullable: true })
  bank_account_id: string | null;

  @ManyToOne(() => BankImport, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'import_id' })
  import_session: BankImport | null;

  @Column({ type: 'uuid', nullable: true })
  import_id: string | null;

  @Column({ type: 'text', nullable: true })
  raw_description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  external_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_inter_account_transfer: boolean;

  @Column({ type: 'uuid', nullable: true })
  linked_transfer_id: string | null;

  @Column({ type: 'boolean', default: false })
  needs_review: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
