import { Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn } from 'typeorm';

/**
 * Дневная аналитика маркетплейса (воронка + продажи) по SKU.
 * WB — nm-report/detail/history, Ozon — /v1/analytics/data. Единая форма.
 */
@Entity('mp_funnel_daily')
@Unique('uq_mp_funnel', ['platform', 'sku', 'date'])
@Index('idx_mp_funnel_sku_date', ['platform', 'sku', 'date'])
export class MpFunnelDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8 })
  platform: 'wb' | 'ozon';

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 32 })
  sku: string;

  @Column({ type: 'numeric', nullable: true })
  views: string | null;

  @Column({ type: 'numeric', nullable: true })
  cart: string | null;

  @Column({ type: 'numeric', nullable: true })
  orders_count: string | null;

  @Column({ type: 'numeric', nullable: true })
  orders_sum: string | null;

  @Column({ type: 'numeric', nullable: true })
  buyouts_count: string | null;

  @Column({ type: 'numeric', nullable: true })
  buyouts_sum: string | null;

  @Column({ type: 'numeric', nullable: true })
  cancels_count: string | null;

  @Column({ type: 'numeric', nullable: true })
  returns_count: string | null;

  @Column({ type: 'numeric', nullable: true })
  cart_conv: string | null;

  @Column({ type: 'numeric', nullable: true })
  order_conv: string | null;

  @Column({ type: 'numeric', nullable: true })
  buyout_percent: string | null;

  @Column({ type: 'numeric', nullable: true })
  avg_price: string | null;

  @Column({ type: 'numeric', nullable: true })
  stock_end: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  product_name: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw: unknown;

  @CreateDateColumn({ name: 'synced_at' })
  synced_at: Date;
}
