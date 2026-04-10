import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { Department } from './Department';

@Entity('department_roles')
@Unique(['user_id', 'department_id'])
export class DepartmentRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', comment: 'ID пользователя' })
  user_id: string;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'uuid', comment: 'ID направления' })
  department_id: string;

  @Column({ type: 'varchar', length: 20, default: 'member', comment: 'Роль: head / member / viewer' })
  role: string;

  @CreateDateColumn()
  created_at: Date;
}
