import 'reflect-metadata';
import { AppDataSource } from '../backend/src/config/database';

// Import the Express app (does NOT call .listen())
import app from '../backend/src/server';

// Lazy-init: reuse connection across warm serverless invocations
let initialized = false;

async function ensureConnection() {
  if (!initialized && !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    initialized = true;
  }
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  await ensureConnection();
  return app(req, res);
}
