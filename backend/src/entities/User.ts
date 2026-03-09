import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  VIEWER = 'viewer',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, comment: 'Email пользователя' })
  email: string;

  @Column({ type: 'varchar', length: 255, comment: 'Хэш пароля' })
  password_hash: string;

  @Column({ type: 'varchar', length: 255, comment: 'Имя пользователя' })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: UserRole,
    default: UserRole.MANAGER,
    comment: 'Роль: admin, manager, viewer',
  })
  role: UserRole;

  @Column({ type: 'boolean', default: true, comment: 'Активен ли пользователь' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
