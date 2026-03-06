import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { TransactionType } from './Transaction';

export enum CategoryGroup {
  OPERATING_INCOME = 'operating_income',
  OPERATING_EXPENSE = 'operating_expense',
  COGS = 'cogs',
  INVESTING = 'investing',
  FINANCING = 'financing',
  OTHER = 'other'
}

@Entity('categories')
@Index(['type'])
@Index(['is_active'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название категории' })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TransactionType,
    comment: 'Тип транзакции для категории'
  })
  type: TransactionType;

  @Column({ type: 'varchar', length: 7, nullable: true, comment: 'Цвет категории (hex)' })
  color: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание категории' })
  description: string;

  @Column({ type: 'boolean', default: true, comment: 'Активна' })
  is_active: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true, comment: 'Группа для финансовых отчётов' })
  group: CategoryGroup;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
