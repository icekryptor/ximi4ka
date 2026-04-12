import { Router, Request, Response } from 'express'
import { handleWebhook } from '../services/telegram.service'

const router = Router()

router.post('/:secret', async (req: Request, res: Response) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 'default-secret'
  if (req.params.secret !== expectedSecret) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  try {
    await handleWebhook(req.body)
    res.sendStatus(200)
  } catch (err: any) {
    console.error('[Telegram Webhook Error]', err.message)
    res.sendStatus(200)
  }
})

export default router
