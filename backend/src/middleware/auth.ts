import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth';

const JWT_SECRET = getJwtSecret();

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
}
