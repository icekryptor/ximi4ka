import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('brand_docs')
export class BrandDoc {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text' })
  slug: string

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'text', nullable: true })
  version: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
