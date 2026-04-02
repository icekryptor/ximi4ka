import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface PresetVariableBlock {
  type: string;
  label: string;
  value_type: 'fixed' | 'percent';
  value: number;
}

@Entity('channel_presets')
export class ChannelPreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  channel_name: string;

  @Column({ type: 'jsonb', default: '[]' })
  variable_blocks: PresetVariableBlock[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
