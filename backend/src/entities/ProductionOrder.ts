import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from './Kit';
import { SalesChannel } from './SalesChannel';

export enum OrderStatus {
  CREATED = 'created',              // Создан
  IN_PRODUCTION = 'in_production',  // В производстве
  QC = 'qc',                        // На проверке ОТК
  PACKING = 'packing',              // Упаковка
  READY = 'ready',                  // Готов к отгрузке
  SHIPPED = 'shipped',              // Отгружен
  AT_MARKETPLACE = 'at_marketplace', // На складе МП
  CANCELLED = 'cancelled',          // Отменён
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'Создан',
  [OrderStatus.IN_PRODUCTION]: 'В производстве',
  [OrderStatus.QC]: 'ОТК',
  [OrderStatus.PACKING]: 'Упаковка',
  [OrderStatus.READY]: 'Готов к отгрузке',
  [OrderStatus.SHIPPED]: 'Отгружен',
  [OrderStatus.AT_MARKETPLACE]: 'На складе МП',
  [OrderStatus.CANCELLED]: 'Отменён',
};

@Entity('production_orders')
@Index(['status'])
@Index(['kit_id'])
@Index(['target_date'])
export class ProductionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Номер заказа' })
  order_number: string;

  @ManyToOne(() => Kit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ comment: 'ID набора (SKU)' })
  kit_id: string;

  @Column({ type: 'int', comment: 'Количество наборов' })
  quantity: number;

  @Column({
    type: 'varchar',
    length: 30,
    enum: OrderStatus,
    default: OrderStatus.CREATED,
    comment: 'Статус заказа',
  })
  status: OrderStatus;

  @ManyToOne(() => SalesChannel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'channel_id' })
  channel: SalesChannel;

  @Column({ nullable: true, comment: 'Целевой канал продаж' })
  channel_id: string;

  @Column({ type: 'date', nullable: true, comment: 'Целевая дата готовности' })
  target_date: string;

  @Column({ type: 'date', nullable: true, comment: 'Фактическая дата завершения' })
  completed_date: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'ID поставки FBO' })
  fbo_shipment_id: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Плановая себестоимость партии' })
  planned_cost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Фактическая себестоимость партии' })
  actual_cost: number;

  @Column({ type: 'int', default: 0, comment: 'Количество прошедших ОТК' })
  qc_passed: number;

  @Column({ type: 'int', default: 0, comment: 'Количество брака' })
  qc_failed: number;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
