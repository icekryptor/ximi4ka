import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Department } from './Department';
import { Employee } from './Employee';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'uuid', comment: 'ID направления' })
  department_id: string;

  @Column({ type: 'varchar', length: 200, comment: 'Название проекта' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание' })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: 'Бюджет' })
  budget: number;

  @Column({ type: 'date', nullable: true, comment: 'Дата начала' })
  start_date: string;

  @Column({ type: 'date', nullable: true, comment: 'Дата окончания' })
  end_date: string;

  @Column({ type: 'text', nullable: true, comment: 'Результаты / deliverables' })
  deliverables: string;

  @Column({ type: 'varchar', length: 20, default: 'draft', comment: 'Статус: draft/active/on_hold/completed/cancelled' })
  status: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_id' })
  responsible: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Ответственный за проект' })
  responsible_id: string;

  @Column({ type: 'uuid', comment: 'Кто создал' })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
