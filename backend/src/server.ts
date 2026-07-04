import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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
import employeeRoutes from './routes/employee.routes';
import productionOrderRoutes from './routes/productionOrder.routes';
import qcRoutes from './routes/qc.routes';
import assemblyRoutes from './routes/assembly.routes';
import salesChannelRoutes from './routes/salesChannel.routes';
import supplyDocumentRoutes from './routes/supplyDocument.routes';
import boardRoutes from './routes/board.routes';
import departmentRoutes from './routes/department.routes';
import recurringTaskRoutes from './routes/recurringTask.routes';
import projectRoutes from './routes/project.routes';
import taskCommentRoutes from './routes/taskComment.routes';
import channelPresetRoutes from './routes/channel-preset.routes';
import contentUnitRoutes from './routes/content-unit.routes';
import contentRubricRoutes from './routes/content-rubric.routes';
import contentPublicationRoutes from './routes/content-publication.routes';
import brandDocRoutes from './routes/brand-doc.routes';
import icpSegmentRoutes from './routes/icp-segment.routes';
import strategicThemeRoutes from './routes/strategic-theme.routes';
import channelBudgetRoutes from './routes/channel-budget.routes';
import channelRoutes from './routes/channel.routes';
import n8nRoutes from './routes/n8n.routes';
import telegramRoutes from './routes/telegram.routes';
import publicProjectRoutes from './routes/publicProject.routes';
import bankAccountRoutes from './routes/bankAccount.routes';
import bankImportRoutes from './routes/bankImport.routes';
import bankSyncRoutes from './routes/bank-sync.routes';
import discountTrackerRoutes from './routes/discount-tracker.routes';
import importRuleRoutes from './routes/importRule.routes';
import cashflowRoutes from './routes/cashflow.routes';
import voiceoverRoutes from './routes/voiceover.routes';
import contentEngineRoutes from './routes/content-engine.routes';
import contentPlanRoutes from './routes/content-plan.routes';
import claudeRoutes from './routes/claude.routes';
import recipeRoutes from './routes/recipe.routes';
import contentMetricSnapshotRoutes, { analyticsHandler } from './routes/content-metric-snapshot.routes';
import okrLinksRoutes from './routes/okr-links.routes';
import { unitEconomicsController } from './controllers/unit-economics.controller';
import { startPublishWorker } from './services/publish-worker';
import { startBankSyncScheduler } from './services/bank-sync/scheduler';
import { startDiscountTrackerScheduler } from './services/discount-tracker/scheduler';
import { recipeEngine } from './services/recipe-engine';

// Middleware
import { authMiddleware } from './middleware/auth';
import { apiKeyAuth } from './middleware/apiKeyAuth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS: allow Vercel frontend, localhost dev, and any extra origins from env
const allowedOrigins = [
  'https://ximi4ka.vercel.app',
  'https://erp.ximi4ka.ru',
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
const isDev = process.env.NODE_ENV !== 'production';
app.use(morgan(isDev ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы — загруженные изображения
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.get('/api/public/unit-economics/:token', unitEconomicsController.getPublicShare);
app.use('/api/public/projects', publicProjectRoutes);

// n8n API — API key auth (no JWT)
app.use('/api/n8n', apiKeyAuth, n8nRoutes);

// Telegram webhook (public — verified by secret in URL)
app.use('/api/webhooks/telegram', telegramRoutes);

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
app.use('/api/employees', authMiddleware, employeeRoutes);
app.use('/api/production-orders', authMiddleware, productionOrderRoutes);
app.use('/api/qc', authMiddleware, qcRoutes);
app.use('/api/assembly', authMiddleware, assemblyRoutes);
app.use('/api/sales-channels', authMiddleware, salesChannelRoutes);
app.use('/api/supply-documents', authMiddleware, supplyDocumentRoutes);
app.use('/api/boards', authMiddleware, boardRoutes);
app.use('/api/departments', authMiddleware, departmentRoutes);
app.use('/api/recurring-tasks', authMiddleware, recurringTaskRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/content-units', authMiddleware, contentUnitRoutes);
app.use('/api/content-rubrics', authMiddleware, contentRubricRoutes);
app.use('/api/content-publications', authMiddleware, contentPublicationRoutes);
app.use('/api/tasks', authMiddleware, taskCommentRoutes);
app.use('/api/channel-presets', authMiddleware, channelPresetRoutes);
app.use('/api/bank-accounts', authMiddleware, bankAccountRoutes);
app.use('/api/bank-imports', authMiddleware, bankImportRoutes);
app.use('/api/bank-sync', authMiddleware, bankSyncRoutes);
app.use('/api/discount-tracker', authMiddleware, discountTrackerRoutes);
app.use('/api/import-rules', authMiddleware, importRuleRoutes);
app.use('/api/cashflow', authMiddleware, cashflowRoutes);
app.use('/api/voiceover', authMiddleware, voiceoverRoutes);
app.use('/api/content-engine', authMiddleware, contentEngineRoutes);
app.use('/api/content-plan', authMiddleware, contentPlanRoutes);
app.use('/api/claude', authMiddleware, claudeRoutes);
app.use('/api/brand-docs', authMiddleware, brandDocRoutes);
app.use('/api/icp-segments', authMiddleware, icpSegmentRoutes);
app.use('/api/strategic-themes', authMiddleware, strategicThemeRoutes);
app.use('/api/channel-budgets', authMiddleware, channelBudgetRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/recipes', authMiddleware, recipeRoutes);
app.use('/api/content-metric-snapshots', authMiddleware, contentMetricSnapshotRoutes);
app.use('/api/okr-links', authMiddleware, okrLinksRoutes);
app.get('/api/marketing/analytics', authMiddleware, analyticsHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'XimERP Backend' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
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

  // Eager-load recipes so YAML parse errors surface at boot (not on first API call)
  // and operators can verify deploy via "[recipe-engine] loaded …" lines in logs.
  recipeEngine.list();

  startPublishWorker();

  console.log('');
  app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log('');

    // Initialize Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { initTelegramListener } = await import('./services/telegram-listener')
      const { initDigestScheduler } = await import('./services/telegram-scheduler')
      const { setupWebhook } = await import('./services/telegram.service')
      initTelegramListener()
      await initDigestScheduler()
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`
      setupWebhook(baseUrl)
    }

    startBankSyncScheduler();
    startDiscountTrackerScheduler();
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
