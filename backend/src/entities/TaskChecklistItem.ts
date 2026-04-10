import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';

@Entity('task_checklist_items')
export class TaskChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'uuid', comment: 'ID задачи' })
  task_id: string;

  @Column({ type: 'varchar', length: 500, comment: 'Текст пункта' })
  title: string;

  @Column({ type: 'boolean', default: false, comment: 'Выполнен ли' })
  is_checked: boolean;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки' })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}
