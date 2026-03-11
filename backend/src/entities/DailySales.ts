import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Kit } from './Kit';

@Entity('daily_sales')
@Unique(['date', 'channel_name', 'kit_id'])
@Index(['date'])
@Index(['kit_id'])
@Index(['channel_name'])
@Index(['date', 'channel_name'])
export class DailySales {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', comment: 'Дата продажи' })
  date: Date;

  @Column({ type: 'varchar', length: 100, comment: 'Канал продаж (ВБ, Озон, Сайт, Оптовые продажи)' })
  channel_name: string;

  @Column({ type: 'uuid', comment: 'Артикул (набор)' })
  kit_id: string;

  @Column({ type: 'varchar', length: 20, default: 'manual', comment: 'Источник: wb_sync или manual' })
  source: string;

  // Продажи
  @Column({ type: 'int', default: 0, comment: 'Количество продаж' })
  sales_count: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Доход с одной продажи' })
  revenue_per_unit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Общий доход' })
  total_revenue: number;

  // Расходы
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Себестоимость за единицу' })
  cost_price_per_unit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Расходы на логистику' })
  logistics_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Расходы на хранение' })
  storage_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Дневной рекламный бюджет' })
  ad_spend: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Прочие расходы' })
  other_costs: number;

  // Рассчитанные
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Общие расходы' })
  total_costs: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Прибыль за день' })
  profit: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0, comment: 'Маржинальность (%)' })
  margin: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;
}
