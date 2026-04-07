// Shared JWT configuration — single source of truth

const isDev = process.env.NODE_ENV !== 'production';

let _jwtSecret: string | null = null;

export function getJwtSecret(): string {
  if (_jwtSecret) return _jwtSecret;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (isDev) {
      console.warn('⚠️  JWT_SECRET не задан — используется dev-ключ. НЕ ИСПОЛЬЗУЙТЕ В PRODUCTION!');
      _jwtSecret = 'ximfinance-dev-secret-key-2024';
      return _jwtSecret;
    }
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }

  _jwtSecret = secret;
  return _jwtSecret;
}

export const JWT_EXPIRY = '24h';
export const JWT_ALGORITHM = 'HS256' as const;
