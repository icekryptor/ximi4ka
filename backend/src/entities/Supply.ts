import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Counterparty } from './Counterparty';
import { SupplyItem } from './SupplyItem';

@Entity('supplies')
@Index(['supplier_id'])
@Index(['supply_date'])
export class Supply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Counterparty;

  @Column({ nullable: true })
  supplier_id: string;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'carrier_id' })
  carrier: Counterparty;

  @Column({ nullable: true })
  carrier_id: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость доставки (общая на поставку)' })
  delivery_cost: number;

  @Column({ type: 'date', nullable: true, comment: 'Дата поставки' })
  supply_date: Date;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @OneToMany(() => SupplyItem, (item) => item.supply, { cascade: true })
  items: SupplyItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
