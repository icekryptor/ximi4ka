import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'ФИО сотрудника' })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Телефон' })
  phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Telegram username' })
  telegram: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'URL фото' })
  photo_url: string;

  @Column({ type: 'text', nullable: true, comment: 'Паспортные данные' })
  passport_data: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: 'Стоимость часа, ₽' })
  hourly_rate: number;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Должность' })
  position: string;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
