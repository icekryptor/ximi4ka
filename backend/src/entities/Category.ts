import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { TransactionType } from './Transaction';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название категории' })
  name: string;

  @Column({
    type: 'enum',
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
