import { Router } from 'express'
import { voiceoverController } from '../controllers/voiceover.controller'

const router = Router()

router.get('/bootstrap', voiceoverController.bootstrap)
router.post('/extend-guide', voiceoverController.extendGuide)
router.post('/cache/refresh', voiceoverController.refreshCache)

export default router
