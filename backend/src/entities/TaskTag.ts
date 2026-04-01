import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Board } from './Board';

@Entity('task_tags')
export class TaskTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, board => board.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ type: 'uuid', comment: 'ID доски' })
  board_id: string;

  @Column({ type: 'varchar', length: 100, comment: 'Название тега' })
  name: string;

  @Column({ type: 'varchar', length: 7, comment: 'Цвет тега (hex)' })
  color: string;

  @CreateDateColumn()
  created_at: Date;
}
