import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Counterparty } from './Counterparty';

export enum ComponentCategory {
  REAGENT = 'reagent',           // Реактивы
  EQUIPMENT = 'equipment',       // Комплектующие
  PRINT = 'print',              // Печатная продукция
  LABOR = 'labor'               // Работа
}

@Entity('components')
export class Component {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название компонента' })
  name: string;

  @Column({
    type: 'enum',
    enum: ComponentCategory,
    comment: 'Категория компонента'
  })
  category: ComponentCategory;

  // Для реактивов
  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Стоимость закупки партии' })
  purchase_cost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Масса партии (г)' })
  batch_weight: number;

  @Column('decimal', { precision: 10, scale: 3, nullable: true, comment: 'Количество на 1 набор (г)' })
  per_kit_amount: number;

  @Column('decimal', { precision: 12, scale: 4, nullable: true, comment: 'Цена за 1 г' })
  price_per_gram: number;

  // Для комплектующих
  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Стоимость доставки' })
  delivery_cost: number;

  @Column({ type: 'int', nullable: true, comment: 'Количество в партии' })
  batch_quantity: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Стоимость в юанях' })
  yuan_cost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Вес (кг)' })
  weight_kg: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true, comment: 'Курс юань/рубль' })
  yuan_to_rub_rate: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true, comment: 'Курс доллар/рубль' })
  usd_to_rub_rate: number;

  // Для печатной продукции
  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Стоимость печати' })
  print_cost: number;

  // Общие поля
  @Column('decimal', { precision: 12, scale: 2, comment: 'Цена за 1 единицу' })
  unit_price: number;

  @Column('decimal', { precision: 10, scale: 3, default: 1, comment: 'Количество в одном наборе' })
  quantity_per_kit: number;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Цена на 1 набор' })
  price_per_kit: number;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Counterparty;

  @Column({ nullable: true })
  supplier_id: string;

  @Column({ type: 'text', nullable: true, comment: 'Примечания' })
  notes: string;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
