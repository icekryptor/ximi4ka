import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { authMiddleware } from '../middleware/auth';
import { getJwtSecret, JWT_EXPIRY, JWT_ALGORITHM } from '../config/auth';

const router = Router();
const JWT_SECRET = getJwtSecret();

function generateToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY, algorithm: JWT_ALGORITHM }
  );
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

// POST /api/auth/register — requires admin authentication
router.post('/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Only admins can create new users
    const userRepo = AppDataSource.getRepository(User);
    const requestingUser = await userRepo.findOne({ where: { id: req.user!.userId } });
    if (!requestingUser || requestingUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Только администратор может создавать пользователей' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, пароль и имя обязательны' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен содержать от 8 до 128 символов' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    const existing = await userRepo.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // SECURITY: Never accept role from client — always assign MANAGER
    const user = userRepo.create({
      email: email.toLowerCase().trim(),
      password_hash,
      name: name.trim().slice(0, 255),
      role: UserRole.MANAGER,
      is_active: true,
    });

    await userRepo.save(user);

    const token = generateToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = generateToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Ошибка при входе в систему' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.user!.userId } });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    return res.json(sanitizeUser(user));
  } catch (error: any) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Ошибка при получении данных пользователя' });
  }
});

export default router;
