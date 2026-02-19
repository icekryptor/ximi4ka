import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

// Entities
import { Transaction } from '../entities/Transaction';
import { Counterparty } from '../entities/Counterparty';
import { Category } from '../entities/Category';
import { Component } from '../entities/Component';
import { Kit } from '../entities/Kit';
import { KitComponent } from '../entities/KitComponent';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'ximfinance_user',
  password: process.env.DATABASE_PASSWORD || 'ximfinance_pass',
  database: process.env.DATABASE_NAME || 'ximfinance',
  synchronize: process.env.NODE_ENV === 'development', // Только для разработки!
  logging: process.env.NODE_ENV === 'development',
  entities: [Transaction, Counterparty, Category, Component, Kit, KitComponent],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
});
