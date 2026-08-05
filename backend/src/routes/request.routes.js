import { Router } from 'express';
import * as ctrl from '../controllers/request.controller.js';
import { requireAuth, requireRole, requireVerifiedEmail } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRequestSchema, searchDonorsSchema } from '../validators/request.schema.js';
import { setStatusSchema } from '../validators/status.schema.js';

const router = Router();

// Donor discovery (compatible + nearby) and radar counts.
router.get('/donors/search', requireAuth, validate(searchDonorsSchema, 'query'), ctrl.searchDonors);
router.get('/donors/radar', requireAuth, validate(searchDonorsSchema, 'query'), ctrl.radar);

router.post('/', requireAuth, requireVerifiedEmail, validate(createRequestSchema), ctrl.create);
router.get('/', requireAuth, ctrl.listActive);
router.get('/mine', requireAuth, ctrl.mine);
router.get('/:id', requireAuth, ctrl.getOne);
router.post('/:id/accept', requireAuth, requireRole('donor'), requireVerifiedEmail, ctrl.accept);
router.post('/:id/donations/:donorId/complete', requireAuth, ctrl.completeDonation);
router.patch('/:id/status', requireAuth, validate(setStatusSchema), ctrl.setStatus);

export default router;
