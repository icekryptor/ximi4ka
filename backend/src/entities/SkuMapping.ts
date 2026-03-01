import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Kit } from './Kit';

@Entity('sku_mappings')
export class SkuMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  marketplace_sku: string;

  @Column({ type: 'varchar', length: 255 })
  product_name: string;

  @ManyToOne(() => Kit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'kit_id' })
  kit: Kit;

  @Column({ nullable: true })
  kit_id: string;

  @CreateDateColumn()
  created_at: Date;
}
