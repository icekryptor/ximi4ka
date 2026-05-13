import { Router } from 'express'
import { contentMetricSnapshotController } from '../controllers/content-metric-snapshot.controller'

const router = Router()

router.get('/', contentMetricSnapshotController.listByPublication)
router.get('/latest', contentMetricSnapshotController.latestForPublications)
router.post('/', contentMetricSnapshotController.create)
router.delete('/:id', contentMetricSnapshotController.delete)
// Analytics endpoint — separate path; mount under /api/marketing/analytics in server.ts
export const analyticsHandler = contentMetricSnapshotController.analytics

export default router
