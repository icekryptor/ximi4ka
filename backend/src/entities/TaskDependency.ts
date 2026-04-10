import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';

@Entity('task_dependencies')
export class TaskDependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'predecessor_id' })
  predecessor: Task;

  @Column({ type: 'uuid', comment: 'Задача-предшественник' })
  predecessor_id: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'successor_id' })
  successor: Task;

  @Column({ type: 'uuid', comment: 'Задача-последователь' })
  successor_id: string;

  @Column({ type: 'varchar', length: 20, default: 'finish_to_start', comment: 'Тип связи' })
  type: string;

  @Column({ type: 'boolean', default: false, comment: 'Блокирующая зависимость' })
  is_blocking: boolean;
}
