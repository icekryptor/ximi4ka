import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

export enum CounterpartyType {
  SUPPLIER = 'supplier',      // Поставщик
  CUSTOMER = 'customer',      // Клиент
  BOTH = 'both'              // И то, и другое
}

@Entity('counterparties')
@Index(['type'])
@Index(['name'])
export class Counterparty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, comment: 'Название контрагента' })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: CounterpartyType,
    default: CounterpartyType.BOTH,
    comment: 'Тип контрагента'
  })
  type: CounterpartyType;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'ИНН' })
  inn: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Адрес' })
  address: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Телефон' })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Email' })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Контактное лицо' })
  contact_person: string;

  @Column({ type: 'text', nullable: true, comment: 'Дополнительная информация' })
  notes: string;

  @Column({ type: 'boolean', default: true, comment: 'Активен' })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
