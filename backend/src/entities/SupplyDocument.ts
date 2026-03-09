import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Supply } from './Supply';

export const DOC_TYPES = ['invoice', 'waybill', 'contract', 'other'] as const;
export type DocType = typeof DOC_TYPES[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice:  'Счёт',
  waybill:  'Накладная',
  contract: 'Договор',
  other:    'Другое',
};

@Entity('supply_documents')
export class SupplyDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'ID поставки' })
  supply_id: string;

  @ManyToOne(() => Supply, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supply_id' })
  supply: Supply;

  @Column({ comment: 'Оригинальное имя файла' })
  original_name: string;

  @Column({ comment: 'Имя файла на диске' })
  filename: string;

  @Column({ comment: 'URL для скачивания' })
  file_url: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'other',
    comment: 'Тип документа: invoice | waybill | contract | other',
  })
  doc_type: string;

  @Column({ type: 'text', nullable: true, comment: 'Примечание к документу' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}
