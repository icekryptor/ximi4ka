import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from './Kit';
import { SalesChannel } from './SalesChannel';

@Entity('unit_economics')
@Index(['kit_id', 'channel_id'])
export class UnitEconomics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ comment: 'ID набора (SKU)' })
  kit_id: string;

  @ManyToOne(() => SalesChannel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: SalesChannel;

  @Column({ comment: 'ID канала продаж' })
  channel_id: string;

  // Входные параметры
  @Column('decimal', { precision: 12, scale: 2, comment: 'Цена продажи, ₽' })
  selling_price: number;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Себестоимость, ₽' })
  cost_price: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: 'Логистика, ₽/шт' })
  logistics_cost: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: 'Хранение, ₽/шт' })
  storage_cost: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'ДРР, %' })
  ad_spend_pct: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'Комиссия МП, %' })
  commission_pct: number;

  // Расчётные поля
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Комиссия МП, ₽' })
  commission_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Расходы на рекламу, ₽' })
  ad_spend_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Unit-маржа, ₽' })
  unit_margin: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'Маржинальность, %' })
  margin_pct: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Период (YYYY-MM)' })
  period: string;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
