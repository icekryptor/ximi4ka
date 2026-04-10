import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { Board } from './Board';
import { Employee } from './Employee';
import { Project } from './Project';
import { TaskComment } from './TaskComment';
import { TaskTag } from './TaskTag';

export enum TaskColumn {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
}

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('tasks')
@Index(['board_id', 'column', 'sort_order'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, board => board.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ type: 'uuid', comment: 'ID доски' })
  board_id: string;

  @Column({ type: 'varchar', length: 500, comment: 'Заголовок задачи' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: 'Описание' })
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: TaskColumn,
    default: TaskColumn.BACKLOG,
    comment: 'Колонка канбана',
  })
  column: TaskColumn;

  @Column({
    type: 'varchar',
    length: 10,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    comment: 'Приоритет',
  })
  priority: TaskPriority;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id' })
  assignee: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Исполнитель' })
  assignee_id: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supervisor_id' })
  supervisor: Employee;

  @Column({ type: 'uuid', nullable: true, comment: 'Супервайзер' })
  supervisor_id: string;

  @Column({ type: 'date', nullable: true, comment: 'Дедлайн' })
  due_date: string;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки (шаг 1000)' })
  sort_order: number;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: Task;

  @Column({ type: 'uuid', nullable: true, comment: 'Родительская задача' })
  parent_id: string;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'uuid', nullable: true, comment: 'ID проекта' })
  project_id: string;

  @Column({ type: 'date', nullable: true, comment: 'Дата начала (для Ганта)' })
  start_date: string;

  @Column({ type: 'int', default: 0, comment: 'Прогресс 0-100' })
  progress: number;

  @Column({ type: 'uuid', comment: 'Кто создал' })
  created_by: string;

  @ManyToMany(() => TaskTag)
  @JoinTable({
    name: 'task_tag_assignments',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TaskTag[];

  @OneToMany(() => TaskComment, comment => comment.task)
  comments: TaskComment[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
