import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { ProjectMember } from '../entities/ProjectMember';
import { Project } from '../entities/Project';
import { getJwtSecret } from '../config/auth';

export interface TelegramAuthPayload {
  projectId: string;
  employeeId: string;
  scope: 'telegram-project';
}

// Extend Express Request to carry telegram auth context
declare global {
  namespace Express {
    interface Request {
      telegramAuth?: TelegramAuthPayload & { role: 'responsible' | 'member' };
    }
  }
}

export async function telegramProjectAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  try {
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret) as TelegramAuthPayload;

    if (payload.scope !== 'telegram-project') {
      res.status(403).json({ error: 'Invalid token scope' });
      return;
    }

    // Verify project ID in token matches route param
    const projectId = req.params.id;
    if (payload.projectId !== projectId) {
      res.status(403).json({ error: 'Token does not match project' });
      return;
    }

    const project = await AppDataSource.getRepository(Project).findOne({
      where: { id: projectId },
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    let role: 'responsible' | 'member' = 'member';

    if (project.responsible_id === payload.employeeId) {
      role = 'responsible';
    } else {
      const membership = await AppDataSource.getRepository(ProjectMember).findOne({
        where: { project_id: projectId, employee_id: payload.employeeId },
      });
      if (!membership) {
        res.status(403).json({ error: 'Not a project member' });
        return;
      }
    }

    req.telegramAuth = { ...payload, role };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}
