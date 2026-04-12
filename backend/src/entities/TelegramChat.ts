import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Project } from './Project'

@Entity('telegram_chats')
export class TelegramChat {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project

  @Column({ type: 'uuid', unique: true, comment: 'ID проекта (один чат на проект)' })
  project_id: string

  @Column({ type: 'bigint', comment: 'Telegram chat ID группы' })
  chat_id: string

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Название группы' })
  chat_title: string

  @Column({ type: 'varchar', length: 50, default: '0 9 * * 1', comment: 'Cron-расписание дайджеста' })
  digest_cron: string

  @Column({ type: 'boolean', default: true, comment: 'Автодайджест вкл/выкл' })
  digest_enabled: boolean

  @Column({ type: 'boolean', default: true, comment: 'Уведомления вкл/выкл' })
  notifications_enabled: boolean

  @CreateDateColumn()
  created_at: Date
}
