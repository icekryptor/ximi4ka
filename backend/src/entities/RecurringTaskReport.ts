import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { RecurringTask } from './RecurringTask';
import { User } from './User';

@Entity('recurring_task_reports')
@Unique(['recurring_task_id', 'report_date'])
export class RecurringTaskReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => RecurringTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurring_task_id' })
  recurring_task: RecurringTask;

  @Column({ type: 'uuid', comment: 'ID регулярной задачи' })
  recurring_task_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'uuid', comment: 'Автор отчёта' })
  author_id: string;

  @Column({ type: 'date', comment: 'Дата отчёта' })
  report_date: string;

  @Column({ type: 'text', comment: 'Текст отчёта' })
  text: string;

  @CreateDateColumn()
  created_at: Date;
}
