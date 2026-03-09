import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from './Kit';
import { SalesChannel } from './SalesChannel';

/**
 * Расчёт маржинальности SKU × канал продаж
 * Must Have: маржинальность с учётом комиссий МП
 */
@Entity('margin_calculations')
@Index(['kit_id', 'channel_id'])
export class MarginCalculation {
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

  // Входные данные
  @Column('decimal', { precision: 12, scale: 2, comment: 'Цена продажи, ₽' })
  selling_price: number;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Себестоимость (из Kit.total_cost)' })
  cost_price: number;

  // Расчётные расходы на канал
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Комиссия площадки, ₽' })
  commission_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Логистика, ₽' })
  logistics_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Хранение, ₽' })
  storage_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Реклама (ДРР), ₽' })
  ad_spend_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Прочие расходы, ₽' })
  other_amount: number;

  // Итоги
  @Column('decimal', { precision: 12, scale: 2, comment: 'Маржа, ₽ = цена − все расходы' })
  margin_amount: number;

  @Column('decimal', { precision: 5, scale: 2, comment: 'Маржинальность, %' })
  margin_pct: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Период расчёта (YYYY-MM)' })
  period: string;

  @CreateDateColumn()
  created_at: Date;
}
