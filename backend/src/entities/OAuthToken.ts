import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('oauth_tokens')
export class OAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 50 })
  provider: string

  @Column({ type: 'text' })
  access_token: string

  @Column({ type: 'text' })
  refresh_token: string

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  channel_name: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
