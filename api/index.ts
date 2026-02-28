import 'reflect-metadata';
import { AppDataSource } from '../backend/src/config/database';

// Import the Express app (does NOT call .listen() on Vercel thanks to VERCEL env check)
import app from '../backend/src/server';

// Lazy-init: reuse connection across warm serverless invocations
let initialized = false;

async function ensureConnection() {
  if (!initialized && !AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      initialized = true;
      console.log('✅ Database connected (serverless)');
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  try {
    await ensureConnection();
  } catch (error: any) {
    return res.status(500).json({
      error: 'Database connection failed',
      message: error.message,
    });
  }
  return app(req, res);
}
