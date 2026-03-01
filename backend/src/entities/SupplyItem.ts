import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Supply } from './Supply';
import { Component } from './Component';

@Entity('supply_items')
@Index(['supply_id'])
@Index(['component_id'])
export class SupplyItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Supply, (supply) => supply.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supply_id' })
  supply: Supply;

  @Column()
  supply_id: string;

  @ManyToOne(() => Component, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'component_id' })
  component: Component;

  @Column()
  component_id: string;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Количество' })
  quantity: number;

  @Column({ type: 'varchar', length: 20, default: 'total', comment: 'Режим ввода цены: unit или total' })
  price_mode: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Введённая цена (за ед. или за партию)' })
  entered_price: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Цена за единицу (рассчитанная)' })
  unit_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Общая стоимость позиции' })
  total_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость доставки за единицу' })
  unit_delivery_cost: number;

  @CreateDateColumn()
  created_at: Date;
}
