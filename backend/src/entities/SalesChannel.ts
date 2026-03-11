import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MarketplaceType {
  WILDBERRIES = 'wildberries',
  OZON = 'ozon',
  DETMIR = 'detmir',      // Детский мир
  WEBSITE = 'website',     // Собственный сайт
  OTHER = 'other',
}

@Entity('sales_channels')
export class SalesChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название канала' })
  name: string;

  @Column({
    type: 'varchar',
    length: 30,
    enum: MarketplaceType,
    comment: 'Тип маркетплейса',
  })
  marketplace: MarketplaceType;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'Комиссия маркетплейса, %' })
  commission_pct: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: 'Стоимость логистики, ₽/шт' })
  logistics_cost: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: 'Стоимость хранения, ₽/шт' })
  storage_cost: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'ДРР (доля рекл. расходов), %' })
  ad_spend_pct: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0, comment: 'Процент возвратов, %' })
  return_rate_pct: number;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
