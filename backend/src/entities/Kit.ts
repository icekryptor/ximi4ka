import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { KitComponent } from './KitComponent';

@Entity('kits')
export class Kit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название набора' })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Артикул' })
  sku: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Артикул продавца (единый для всех площадок)' })
  seller_sku: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание набора' })
  description: string;

  @Column({ type: 'int', default: 1, comment: 'Размер партии' })
  batch_size: number;

  // Расчетные стоимости
  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость реактивов' })
  reagents_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость комплектующих' })
  equipment_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость печатной продукции' })
  print_cost: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: 'Стоимость работы' })
  labor_cost: number;

  @Column('decimal', { precision: 12, scale: 2, comment: 'Себестоимость одного набора' })
  total_cost: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Расчётная себестоимость (вводится вручную)' })
  estimated_cost: number;

  // Цены продажи
  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Розничная цена' })
  retail_price: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true, comment: 'Оптовая цена' })
  wholesale_price: number;

  @OneToMany(() => KitComponent, kitComponent => kitComponent.kit)
  components: KitComponent[];

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
