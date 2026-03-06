import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Component } from './Component';

@Entity('component_parts')
@Index(['composite_id'])
@Index(['part_id'])
export class ComponentPart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'ID сложного компонента' })
  composite_id: string;

  @Column({ comment: 'ID простого компонента (детали)' })
  part_id: string;

  @Column('decimal', { precision: 10, scale: 3, default: 1, comment: 'Количество деталей' })
  quantity: number;

  @ManyToOne(() => Component, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'composite_id' })
  composite: Component;

  @ManyToOne(() => Component, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'part_id' })
  part: Component;

  @CreateDateColumn()
  created_at: Date;
}
