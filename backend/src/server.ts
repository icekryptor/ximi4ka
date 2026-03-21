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
import authRoutes from './routes/auth';
import salesReportRoutes from './routes/sales-report.routes';

// Middleware
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS: allow Vercel frontend, localhost dev, and any extra origins from env
const allowedOrigins = [
  'https://ximi4ka.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].map(o => o.replace(/\/$/, '')); // strip trailing slashes

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Also allow any *.vercel.app preview deploys
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы — загруженные изображения
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/counterparties', authMiddleware, counterpartyRoutes);
app.use('/api/categories', authMiddleware, categoryRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/components', authMiddleware, componentRoutes);
app.use('/api/kits', authMiddleware, kitRoutes);
app.use('/api/supplies', authMiddleware, supplyRoutes);
app.use('/api/financial-reports', authMiddleware, financialReportRoutes);
app.use('/api/marketplace', authMiddleware, marketplaceRoutes);
app.use('/api/wb-ads', authMiddleware, wbAdsRoutes);
app.use('/api/wb-finance', authMiddleware, wbFinanceRoutes);
app.use('/api/unit-economics', authMiddleware, unitEconomicsRoutes);
app.use('/api/sales-report', authMiddleware, salesReportRoutes);

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
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Внутренняя ошибка сервера'
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
