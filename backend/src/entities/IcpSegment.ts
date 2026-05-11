import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('icp_segment')
export class IcpSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  age_range: string | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  role: string | null

  @Column({ type: 'int', default: 0 })
  sort_order: number

  @Column({ type: 'boolean', default: true })
  active: boolean

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
