import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './Task';

@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Task, task => task.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'uuid', comment: 'ID задачи' })
  task_id: string;

  @Column({ type: 'uuid', comment: 'Автор комментария (User.id)' })
  author_id: string;

  @Column({ type: 'text', comment: 'Текст комментария' })
  text: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, comment: 'URL файла в Supabase Storage' })
  attachment_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Имя файла' })
  attachment_name: string;

  @CreateDateColumn()
  created_at: Date;
}
