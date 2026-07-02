import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Глобальные настройки приложения (key → jsonb value),
// например labor_rate_per_hour — ставка труда для схемы сборки.
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn()
  updated_at: Date;
}
