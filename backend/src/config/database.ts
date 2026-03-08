import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

// Entities
import { Transaction } from '../entities/Transaction';
import { Counterparty } from '../entities/Counterparty';
import { Category } from '../entities/Category';
import { Component } from '../entities/Component';
import { ComponentPart } from '../entities/ComponentPart';
import { Kit } from '../entities/Kit';
import { KitComponent } from '../entities/KitComponent';
import { Supply } from '../entities/Supply';
import { SupplyItem } from '../entities/SupplyItem';
import { MarketplaceSale } from '../entities/MarketplaceSale';
import { SkuMapping } from '../entities/SkuMapping';
import { WbAdStat } from '../entities/WbAdStat';
import { WbAdNote } from '../entities/WbAdNote';
import { WbFinancialStat } from '../entities/WbFinancialStat';
import { UnitEconomicsCalculation } from '../entities/UnitEconomicsCalculation';

dotenv.config();

// Supabase (и другие облачные PostgreSQL): задайте DATABASE_URL.
// Локально можно использовать отдельные переменные или DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL;

const isDev = process.env.NODE_ENV === 'development';

const dataSourceOptions = databaseUrl
  ? {
      type: 'postgres' as const,
      url: databaseUrl,
      synchronize: false,
      logging: isDev,
      entities: [Transaction, Counterparty, Category, Component, ComponentPart, Kit, KitComponent, Supply, SupplyItem, MarketplaceSale, SkuMapping, WbAdStat, WbAdNote, WbFinancialStat, UnitEconomicsCalculation],
      migrations: ['src/migrations/**/*.ts'],
      subscribers: [],
      ssl: { rejectUnauthorized: false },
      extra: {
        // Long-running server: reasonable pool size
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
    }
  : {
      type: 'postgres' as const,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'ximfinance_user',
      password: process.env.DATABASE_PASSWORD || 'ximfinance_pass',
      database: process.env.DATABASE_NAME || 'ximfinance',
      synchronize: isDev,
      logging: isDev,
      entities: [Transaction, Counterparty, Category, Component, ComponentPart, Kit, KitComponent, Supply, SupplyItem, MarketplaceSale, SkuMapping, WbAdStat, WbAdNote, WbFinancialStat, UnitEconomicsCalculation],
      migrations: ['src/migrations/**/*.ts'],
      subscribers: [],
    };

export const AppDataSource = new DataSource(dataSourceOptions);
