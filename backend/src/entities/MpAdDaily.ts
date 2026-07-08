import { Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn } from 'typeorm';

/**
 * Дневная реклама по источнику трафика (WB РК-выгрузки: au=аукцион, apk=авто, cpc=поиск)
 * на артикул. Показы/клики/расход/корзины/заказы (РК-атрибуция).
 */
@Entity('mp_ad_daily')
@Unique('uq_mp_ad', ['platform', 'sku', 'date', 'source'])
@Index('idx_mp_ad_sku_date', ['platform', 'sku', 'date'])
export class MpAdDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8 })
  platform: 'wb' | 'ozon';

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 32 })
  sku: string;

  @Column({ type: 'varchar', length: 16 })
  source: string;

  @Column({ type: 'numeric', nullable: true })
  impressions: string | null;

  @Column({ type: 'numeric', nullable: true })
  clicks: string | null;

  @Column({ type: 'numeric', nullable: true })
  spend: string | null;

  @Column({ type: 'numeric', nullable: true })
  carts: string | null;

  @Column({ type: 'numeric', nullable: true })
  orders: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw: unknown;

  @CreateDateColumn({ name: 'synced_at' })
  synced_at: Date;
}
