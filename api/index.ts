import 'reflect-metadata';
import { AppDataSource } from '../backend/src/config/database';

// Import the Express app (does NOT call .listen() on Vercel thanks to VERCEL env check)
import app from '../backend/src/server';

// Promise-based singleton: all concurrent requests await the SAME initialization promise
let initPromise: Promise<void> | null = null;

function ensureConnection(): Promise<void> {
  if (AppDataSource.isInitialized) {
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = AppDataSource.initialize()
      .then(() => {
        console.log('✅ Database connected (serverless)');
      })
      .catch((error: any) => {
        // Reset so next request retries instead of caching the failure
        initPromise = null;
        console.error('❌ Database connection failed:', error.message);
        throw error;
      });
  }
  return initPromise;
}

// Vercel serverless handler with retry for transient pool exhaustion
export default async function handler(req: any, res: any) {
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await ensureConnection();
      return app(req, res);
    } catch (error: any) {
      const isPoolExhausted = error.message?.includes('MaxClients');
      if (isPoolExhausted && attempt < MAX_RETRIES) {
        // Wait briefly before retry — other connections may free up
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res.status(500).json({
        error: 'Database connection failed',
        message: error.message,
      });
    }
  }
}
