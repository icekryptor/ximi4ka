import { Request, Response } from 'express'
import { listStylePatterns } from '../services/content-context.service'

const DEFAULT_FORMAT = 'short_post'

export const stylePatternController = {
  // GET /api/style-patterns?format= — read-only свод накопленных правил стиля
  // для харнесса. Пишет правила только агент через MCP (save_style_patterns).
  async list(req: Request, res: Response) {
    try {
      const format =
        typeof req.query.format === 'string' && req.query.format.trim()
          ? req.query.format.trim()
          : DEFAULT_FORMAT
      const patterns = await listStylePatterns(format)
      res.json({ format, patterns })
    } catch (e: any) {
      console.error('[style-pattern.list]', e?.message || e)
      res.status(500).json({ error: 'Ошибка загрузки правил стиля' })
    }
  },
}
