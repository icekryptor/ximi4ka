import 'reflect-metadata';
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
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
AppDataSource.initialize()
  .then(() => {
    console.log('✅ База данных подключена');
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    console.error('❌ Ошибка подключения к базе данных:', error);
    process.exit(1);
  });

export default app;
