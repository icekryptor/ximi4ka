import { Request, Response, NextFunction } from 'express'

/**
 * Middleware for API key authentication (used by n8n).
 * Checks X-API-Key header against N8N_API_KEY env var.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key']
  const expectedKey = process.env.N8N_API_KEY

  if (!expectedKey) {
    res.status(500).json({ error: 'N8N_API_KEY not configured on server' })
    return
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid or missing API key' })
    return
  }

  next()
}
