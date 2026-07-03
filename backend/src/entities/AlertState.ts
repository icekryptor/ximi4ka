import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Память алертов СПП/соинвест-трекера — чтобы не спамить об одном событии.
 * Composite PK (platform, sku). last_pct — numeric, приходит строкой (Number() при чтении).
 */
@Entity('alert_state')
export class AlertState {
  @PrimaryColumn({ type: 'text' })
  platform: string;

  @PrimaryColumn({ type: 'text' })
  sku: string;

  @Column({ type: 'numeric', nullable: true, comment: 'Последняя доля площадки (0..1)' })
  last_pct: string | null;

  @Column({ type: 'timestamptz', nullable: true, comment: 'Когда последний раз алертили' })
  last_alerted: Date | null;
}
