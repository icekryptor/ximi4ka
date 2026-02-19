import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn
} from 'typeorm';
import { Kit } from './Kit';
import { Component } from './Component';

@Entity('kit_components')
export class KitComponent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Kit, kit => kit.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column()
  kit_id: string;

  @ManyToOne(() => Component, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'component_id' })
  component: Component;

  @Column()
  component_id: string;

  @Column('decimal', { precision: 10, scale: 3, comment: 'Количество компонента в наборе' })
  quantity: number;

  @Column({ type: 'text', nullable: true, comment: 'Примечания' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
