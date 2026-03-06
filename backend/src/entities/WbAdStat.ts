import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('wb_ad_stats')
@Index(['date', 'nm_id'])
@Index(['campaign_id', 'date'])
@Index(['date'])
@Unique(['date', 'campaign_id', 'nm_id'])
export class WbAdStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', comment: 'Дата' })
  date: Date;

  @Column({ type: 'int', comment: 'WB advertId' })
  campaign_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Название кампании' })
  campaign_name: string;

  @Column({ type: 'int', nullable: true, comment: 'Тип кампании (4=каталог, 5=карточка, 6=поиск, 7=рекоменд, 8=авто, 9=поиск+кат)' })
  campaign_type: number;

  @Column({ type: 'bigint', comment: 'Артикул (nmId)' })
  nm_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Название товара' })
  product_name: string;

  @Column({ type: 'int', default: 0, comment: 'Показы' })
  views: number;

  @Column({ type: 'int', default: 0, comment: 'Переходы (клики)' })
  clicks: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0, comment: 'CTR %' })
  ctr: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость клика' })
  cpc: number;

  @Column({ type: 'int', default: 0, comment: 'Корзины (add to basket)' })
  atbs: number;

  @Column({ type: 'int', default: 0, comment: 'Заказы (шт)' })
  orders_count: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Сумма заказов (sum_price из API)' })
  orders_sum: number;

  @Column({ type: 'int', default: 0, comment: 'Штуки' })
  shks: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Расход рекламы (sum из API)' })
  ad_spend: number;

  @Column({ type: 'int', default: 0, comment: 'Отмены' })
  canceled: number;

  @Column({ type: 'int', default: 0, comment: 'Выкупы (шт) — отдельный источник' })
  buyouts_count: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Сумма выкупов — отдельный источник' })
  buyouts_sum: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
