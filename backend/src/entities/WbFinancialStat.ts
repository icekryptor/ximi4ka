import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('wb_financial_stats')
@Index(['date', 'nm_id'])
@Index(['date'])
@Unique(['date', 'nm_id'])
export class WbFinancialStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', comment: 'Дата' })
  date: Date;

  @Column({ type: 'bigint', comment: 'Артикул (nmId)' })
  nm_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Название товара' })
  product_name: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Сумма выкупов (retail_amount)' })
  buyouts_sum: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'К перечислению (ppvz_for_pay)' })
  transfer_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость логистики (delivery_rub)' })
  logistics_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость хранения (storage_fee)' })
  storage_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Прочие удержания (penalty + additional_payment + rebill_logistic_cost + ...)' })
  other_costs: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Удержание (acceptance)' })
  acceptance_cost: number;

  @Column({ type: 'int', default: 0, comment: 'Количество возвратов' })
  returns_count: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Сумма возвратов' })
  returns_sum: number;

  @Column({ type: 'int', default: 0, comment: 'Количество продаж' })
  sales_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
