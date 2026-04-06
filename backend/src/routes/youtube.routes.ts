import { Router, Request, Response } from 'express'
import { getAuthUrl, getConnectionStatus } from '../services/youtube.service'

const router = Router()

// GET /api/youtube/status — check if YouTube is connected
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getConnectionStatus()
    res.json(status)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/youtube/auth-url — get OAuth authorization URL
router.get('/auth-url', (req: Request, res: Response) => {
  try {
    const url = getAuthUrl()
    res.json({ url })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
