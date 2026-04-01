import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Task } from './Task';
import { TaskTag } from './TaskTag';

@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название доски' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание' })
  description: string;

  @Column({ type: 'varchar', length: 7, nullable: true, comment: 'Цвет таба (hex)' })
  color: string;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки' })
  sort_order: number;

  @Column({ type: 'uuid', comment: 'Кто создал' })
  created_by: string;

  @Column({ type: 'boolean', default: false, comment: 'Архивирована' })
  is_archived: boolean;

  @OneToMany(() => Task, task => task.board)
  tasks: Task[];

  @OneToMany(() => TaskTag, tag => tag.board)
  tags: TaskTag[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
