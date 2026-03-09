import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from './Kit';

@Entity('qc_checklists')
@Index(['kit_id'])
export class QcChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название чек-листа' })
  name: string;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ comment: 'ID набора' })
  kit_id: string;

  @Column({ type: 'int', default: 1, comment: 'Версия чек-листа' })
  version: number;

  /**
   * Пункты чек-листа хранятся как JSON-массив:
   * [{ "id": "1", "text": "Все реактивы на месте", "category": "комплектность" }, ...]
   */
  @Column({ type: 'jsonb', default: '[]', comment: 'Пункты проверки (JSON)' })
  items: Array<{ id: string; text: string; category?: string }>;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @Column({ type: 'text', nullable: true, comment: 'Заметки' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
