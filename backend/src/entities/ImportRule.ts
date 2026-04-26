import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('import_rules')
export class ImportRule {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 30 })
  match_type: 'inn' | 'name_keyword' | 'description_keyword'

  @Column({ type: 'varchar', length: 255 })
  match_value: string

  @Column({ type: 'uuid', nullable: true })
  counterparty_id: string | null

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null

  @Column({ type: 'boolean', default: false })
  is_inter_transfer: boolean

  @Column({ type: 'integer', default: 0 })
  hit_count: number

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null

  @CreateDateColumn() created_at: Date
}
