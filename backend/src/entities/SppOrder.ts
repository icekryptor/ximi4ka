import { Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn } from 'typeorm';

/**
 * Факт СПП по конкретному заказу (WB order / Ozon posting).
 * СПП = разница между ценой продавца (seller_price) и ценой покупателя (buyer_price).
 * Дневные агрегаты считаются во view v_spp_daily.
 */
@Entity('spp_order')
@Unique('uq_spp_order', ['platform', 'order_id'])
@Index('idx_spp_order_sku_date', ['platform', 'nm_id', 'order_date'])
export class SppOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8 })
  platform: 'wb' | 'ozon';

  @Column({ type: 'varchar', length: 32 })
  nm_id: string;

  @Column({ type: 'varchar', length: 64 })
  order_id: string;

  @Column({ type: 'date' })
  order_date: string;

  @Column({ type: 'numeric', nullable: true })
  seller_price: string | null;

  @Column({ type: 'numeric', nullable: true })
  buyer_price: string | null;

  @Column({ type: 'numeric', nullable: true })
  spp_pct: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  region: string | null;

  @Column({ type: 'boolean', default: false })
  is_cancel: boolean;

  @Column({ type: 'jsonb', nullable: true })
  raw: unknown;

  @CreateDateColumn({ name: 'synced_at' })
  synced_at: Date;
}
