import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Kit } from './Kit';

export interface VariableBlock {
  type: string;
  label: string;
  value_type: 'fixed' | 'percent';
  value: number;
}

export type CostType = 'estimated' | 'actual';

@Entity('unit_economics_calculations')
export class UnitEconomicsCalculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  kit_id: string;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  channel_name: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  seller_price: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  start_price: number;

  @Column('decimal', { precision: 6, scale: 2, nullable: true })
  seller_discount: number;

  @Column({ type: 'varchar', length: 20, default: 'estimated' })
  cost_type: CostType;

  @Column('decimal', { precision: 6, scale: 2, default: 0 })
  tax_rate: number;

  @Column({ type: 'jsonb', default: '[]' })
  variable_blocks: VariableBlock[];

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  cost_price: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_expenses: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  profit: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  margin: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
