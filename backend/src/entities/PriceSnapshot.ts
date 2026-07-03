import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Часовой снапшот цен СПП/соинвест-трекера.
 * ВНИМАНИЕ: в БД id — bigint generated always as identity,
 * поэтому вставка идёт через AppDataSource.query (см. discount-tracker.service.ts).
 * numeric-колонки TypeORM возвращает строками — конвертировать Number() при чтении.
 */
@Entity('price_snapshots')
@Index('idx_snap_sku_time', ['platform', 'sku', 'captured_at'])
export class PriceSnapshot {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  captured_at: Date;

  @Column({ type: 'text', comment: 'wb | ozon' })
  platform: string;

  @Column({ type: 'text', comment: 'nmId (WB) | offer_id (Ozon)' })
  sku: string;

  @Column({ type: 'numeric', nullable: true, comment: 'Цена продавца (база комиссии, до СПП/соинвеста)' })
  seller_price: string | null;

  @Column({ type: 'numeric', nullable: true, comment: 'Цена на витрине (что видит покупатель)' })
  shelf_price: string | null;

  @Column({ type: 'numeric', nullable: true, comment: 'Своя скидка (руб), только Ozon разводит явно' })
  own_discount: string | null;

  @Column({ type: 'numeric', nullable: true, comment: 'Доля площадки: СПП (WB) / соинвест (Ozon), руб' })
  platform_disc: string | null;

  @Column({ type: 'numeric', nullable: true, comment: '1 - shelf/seller, доля общей скидки' })
  discount_pct: string | null;

  @Column({ type: 'numeric', nullable: true, comment: 'platform_disc / seller_price — «чистая» СПП/соинвест' })
  platform_pct: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: 'Сырой ответ API' })
  raw: unknown;
}
