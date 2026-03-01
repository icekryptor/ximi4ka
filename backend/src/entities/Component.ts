import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Counterparty } from './Counterparty';
import { ComponentPart } from './ComponentPart';

export enum ComponentCategory {
  REAGENT = 'reagent',           // Реактивы
  METAL = 'metal',               // Металлы (кг→г, как реактивы)
  EQUIPMENT = 'equipment',       // Комплектующие
  PRINT = 'print',              // Печатная продукция
  LABOR = 'labor'               // Работа
}

@Entity('components')
@Index(['category', 'is_active'])
@Index(['supplier_id'])
export class Component {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название компонента' })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Артикул' })
  sku: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ComponentCategory,
    comment: 'Категория компонента'
  })
  category: ComponentCategory;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Размеры (Д×Ш×В)' })
  dimensions: string;

  @Column({ type: 'text', nullable: true, comment: 'Ссылка на 1688' })
  link_1688: string;

  @Column({ type: 'text', nullable: true, comment: 'Ссылка на регламент' })
  regulation_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Название фабрики/поставщика' })
  factory: string;

  // Для реактивов
  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Стоимость закупки партии' })
  purchase_cost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Масса партии (г)' })
  batch_weight: number;

  @Column('decimal', { precision: 12, scale: 4, nullable: true, comment: 'Количество на 1 набор (г)' })
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

  // Структура стоимости
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость материалов' })
  cost_materials: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость логистики' })
  cost_logistics: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость работы' })
  cost_labor: number;

  // Итоговая цена = cost_materials + cost_logistics + cost_labor (хранится для удобства запросов)
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Итоговая цена за 1 единицу' })
  unit_price: number;

  @Column('decimal', { precision: 10, scale: 3, default: 1, comment: 'Количество в одном наборе' })
  quantity_per_kit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Цена на 1 набор' })
  price_per_kit: number;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Counterparty;

  @Column({ nullable: true })
  supplier_id: string;

  @ManyToOne(() => Counterparty, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'carrier_id' })
  carrier: Counterparty;

  @Column({ nullable: true })
  carrier_id: string;

  @Column({ type: 'text', nullable: true, comment: 'URL изображения компонента' })
  image_url: string;

  @Column({ type: 'text', nullable: true, comment: 'Примечания' })
  notes: string;

  @Column({ type: 'boolean', default: false, comment: 'Сложный компонент (состоит из деталей)' })
  is_composite: boolean;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @OneToMany(() => ComponentPart, cp => cp.composite)
  parts: ComponentPart[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
