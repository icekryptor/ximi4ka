import { Router } from 'express'
import { voiceoverController } from '../controllers/voiceover.controller'

const router = Router()

router.get('/bootstrap', voiceoverController.bootstrap)

export default router
