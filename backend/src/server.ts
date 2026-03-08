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
import supplyRoutes from './routes/supply.routes';
import financialReportRoutes from './routes/financial-report.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import wbAdsRoutes from './routes/wb-ads.routes';
import wbFinanceRoutes from './routes/wb-finance.routes';
import unitEconomicsRoutes from './routes/unit-economics.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы — загруженные изображения
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/counterparties', counterpartyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api/supplies', supplyRoutes);
app.use('/api/financial-reports', financialReportRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/wb-ads', wbAdsRoutes);
app.use('/api/wb-finance', wbFinanceRoutes);
app.use('/api/unit-economics', unitEconomicsRoutes);

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

  // SAFETY: Never auto-synchronize Supabase — use migrations instead
  // synchronize() can drop columns and cause data loss

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
