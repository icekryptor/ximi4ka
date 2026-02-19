import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Counterparty } from './Counterparty';
import { Category } from './Category';

export enum TransactionType {
  INCOME = 'income',    // Доход
  EXPENSE = 'expense'   // Расход
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
