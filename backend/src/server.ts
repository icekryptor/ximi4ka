import 'reflect-metadata';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database';

// Routes
import transactionRoutes from './routes/transaction.routes';
import counterpartyRoutes from './routes/counterparty.routes';
import categoryRoutes from './routes/category.routes';
import reportRoutes from './routes/report.routes';
import componentRoutes from './routes/component.routes';
import kitRoutes from './routes/kit.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы — загруженные изображения
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/counterparties', counterpartyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/kits', kitRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'XimFinance Backend' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера'
  });
});

// Инициализация базы данных и запуск сервера
async function bootstrap() {
  console.log('Подключение к базе данных...');
  await AppDataSource.initialize();

  const isSupabase = 'url' in AppDataSource.options;
  const dbInfo = isSupabase ? 'Supabase/PostgreSQL' : (AppDataSource.options as any).database || 'PostgreSQL';
  console.log('✅ База данных подключена:', dbInfo);

  // Для Supabase (synchronize: false) — синхронизируем схему без потери данных
  if (isSupabase && process.env.NODE_ENV === 'development') {
    console.log('   Синхронизация схемы...');
    await AppDataSource.synchronize();
    console.log('   ✅ Схема синхронизирована');
  }

  console.log('');
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

// Only start the server when running directly (not in Vercel serverless)
if (!process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error('❌ Ошибка подключения к базе данных:', error.message || error);
    process.exit(1);
  });
}

export default app;
