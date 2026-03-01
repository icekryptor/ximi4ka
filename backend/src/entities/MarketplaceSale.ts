import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Marketplace {
  WILDBERRIES = 'wildberries',
  WEBSITE = 'website',
}

@Entity('marketplace_sales')
export class MarketplaceSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  marketplace: Marketplace;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  product_name: string;

  @Column({ type: 'int', default: 0 })
  orders_count: number;

  @Column({ type: 'int', default: 0 })
  buyouts_count: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  revenue: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  commission: number;

  @Column('decimal', { precision: 8, scale: 2, default: 28.5 })
  commission_rate: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  logistics_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  storage_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  other_costs: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  acquiring_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  payout: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
