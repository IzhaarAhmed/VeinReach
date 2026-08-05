import { Router } from 'express';
import * as ctrl from '../controllers/hospital.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { searchDonorsSchema } from '../validators/request.schema.js';

const router = Router();

router.use(requireAuth, requireRole('hospital'));

// Hospitals create requests via POST /requests and verify donations via
// POST /requests/:id/donations/:donorId/complete (both already role-aware).
router.get('/donations', ctrl.donations);
router.get('/stats', ctrl.stats);
router.get('/donors', validate(searchDonorsSchema, 'query'), ctrl.nearbyDonors);

export default router;
