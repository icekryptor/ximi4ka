import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Department } from './Department';
import { Employee } from './Employee';

@Entity('recurring_tasks')
export class RecurringTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'uuid', comment: 'ID направления' })
  department_id: string;

  @Column({ type: 'varchar', length: 300, comment: 'Название задачи' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: 'Инструкция к отчёту (неизменяемая)' })
  instruction: string;

  @Column({ type: 'varchar', length: 20, default: 'daily', comment: 'Частота: daily/weekly/monthly/custom' })
  frequency: string;

  @Column({ type: 'simple-array', nullable: true, comment: 'Дни недели для custom (1=Пн, 7=Вс)' })
  frequency_days: number[];

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Исполнитель' })
  assignee_id: string;

  @Column({ type: 'boolean', default: true, comment: 'Активна' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
