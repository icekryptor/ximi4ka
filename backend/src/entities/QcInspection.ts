import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProductionOrder } from './ProductionOrder';
import { QcChecklist } from './QcChecklist';
import { Employee } from './Employee';

export enum InspectionResult {
  PASS = 'pass',
  FAIL = 'fail',
  CONDITIONAL = 'conditional',  // Условный допуск
}

@Entity('qc_inspections')
@Index(['order_id'])
@Index(['result'])
export class QcInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductionOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: ProductionOrder;

  @Column({ comment: 'ID заказа на производство' })
  order_id: string;

  @ManyToOne(() => QcChecklist, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'checklist_id' })
  checklist: QcChecklist;

  @Column({ nullable: true, comment: 'ID чек-листа' })
  checklist_id: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inspector_id' })
  inspector: Employee;

  @Column({ nullable: true, comment: 'ID контролёра' })
  inspector_id: string;

  @Column({ type: 'int', comment: 'Количество проверенных единиц' })
  inspected_qty: number;

  @Column({ type: 'int', default: 0, comment: 'Количество годных' })
  passed_qty: number;

  @Column({ type: 'int', default: 0, comment: 'Количество брака' })
  failed_qty: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: InspectionResult,
    comment: 'Результат проверки',
  })
  result: InspectionResult;

  /**
   * Результаты по каждому пункту чек-листа:
   * [{ "item_id": "1", "passed": true, "comment": "" }, ...]
   */
  @Column({ type: 'jsonb', default: '[]', comment: 'Результаты по пунктам' })
  item_results: Array<{ item_id: string; passed: boolean; comment?: string }>;

  @Column({ type: 'text', nullable: true, comment: 'Описание дефектов' })
  defect_description: string;

  @Column({ type: 'simple-array', nullable: true, comment: 'URL фото дефектов' })
  defect_photos: string[];

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Номер партии' })
  batch_number: string;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
