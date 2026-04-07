import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import bcrypt from 'bcrypt';

async function seedAdmin() {
  try {
    await AppDataSource.initialize();
    console.log('📦 Database connected');

    // Create users table if not exists
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'manager',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Users table ready');

    const userRepo = AppDataSource.getRepository(User);

    // Check if admin already exists
    const existing = await userRepo.findOne({ where: { email: 'admin@ximi4ka.ru' } });
    if (existing) {
      console.log('⚠️  Admin user already exists, skipping...');
    } else {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          console.error('❌ ADMIN_PASSWORD env var is required in production!');
          process.exit(1);
        }
        console.warn('⚠️  ADMIN_PASSWORD не задан — используется пароль по умолчанию. НЕ ИСПОЛЬЗУЙТЕ В PRODUCTION!');
      }
      const password_hash = await bcrypt.hash(adminPassword || 'admin123', 12);
      const admin = userRepo.create({
        email: 'admin@ximi4ka.ru',
        password_hash,
        name: 'Администратор',
        role: UserRole.ADMIN,
        is_active: true,
      });
      await userRepo.save(admin);
      console.log('✅ Admin user created:');
      console.log('   📧 Email: admin@ximi4ka.ru');
      console.log('   👤 Role: admin');
      if (!process.env.ADMIN_PASSWORD) {
        console.log('   ⚠️  Using default password. Set ADMIN_PASSWORD env var for production!');
      }
    }

    await AppDataSource.destroy();
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedAdmin();
