import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: 'Название направления' })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true, comment: 'Цвет (hex)' })
  color: string;

  @Column({ type: 'int', default: 0, comment: 'Порядок сортировки' })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;
}
