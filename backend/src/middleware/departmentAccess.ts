import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { DepartmentRole } from '../entities/DepartmentRole';
import { UserRole } from '../entities/User';

const roleRepo = () => AppDataSource.getRepository(DepartmentRole);

const ROLE_LEVELS: Record<string, number> = {
  viewer: 1,
  member: 2,
  head: 3,
};

export function departmentAccess(minRole: 'viewer' | 'member' | 'head') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      if (user.role === UserRole.ADMIN) return next();

      const departmentId = req.params.departmentId || req.params.id;
      if (!departmentId) {
        return res.status(400).json({ error: 'department ID required' });
      }

      const membership = await roleRepo().findOne({
        where: { user_id: user.userId, department_id: departmentId },
      });

      if (!membership) {
        return res.status(403).json({ error: 'Нет доступа к направлению' });
      }

      const userLevel = ROLE_LEVELS[membership.role] || 0;
      const requiredLevel = ROLE_LEVELS[minRole] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

      (req as any).departmentRole = membership.role;
      next();
    } catch (error) {
      console.error('Department access check error:', error);
      res.status(500).json({ error: 'Ошибка проверки доступа' });
    }
  };
}
