import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';
import { TaskTag } from './TaskTag';
import { Department } from './Department';

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

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'uuid', nullable: true, comment: 'ID направления' })
  department_id: string;

  @OneToMany(() => Task, task => task.board)
  tasks: Task[];

  @OneToMany(() => TaskTag, tag => tag.board)
  tags: TaskTag[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
