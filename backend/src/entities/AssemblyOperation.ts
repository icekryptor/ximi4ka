import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Component } from './Component';

// Операция сборки привязана к КОМПОЗИТУ (сущности, которую производит), не к ребру BOM:
// у узла может быть несколько операций (розлив + закупорка), стоимость работы
// узла = Σ time_seconds/3600 × ставка (app_settings.labor_rate_per_hour).
@Entity('assembly_operations')
@Index(['composite_id'])
export class AssemblyOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', comment: 'ID композита, который производит операция' })
  composite_id: string;

  @ManyToOne(() => Component, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'composite_id' })
  composite: Component;

  @Column({ type: 'varchar', length: 255, comment: 'Название операции («Розлив», «Закупорка и проклейка»)' })
  name: string;

  @Column({ type: 'int', default: 0, comment: 'Этап производства (1-10)' })
  stage: number;

  @Column({ type: 'int', nullable: true, comment: 'Норматив времени, сек (NULL = не заполнен)' })
  time_seconds: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Слаг регламента в brand_docs (kb-*)' })
  instruction_slug: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
