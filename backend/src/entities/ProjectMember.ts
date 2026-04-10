import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './Project';
import { Employee } from './Employee';

@Entity('project_members')
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'uuid', comment: 'ID проекта' })
  project_id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid', comment: 'ID сотрудника' })
  employee_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Роль в проекте' })
  role: string;

  @CreateDateColumn()
  created_at: Date;
}
