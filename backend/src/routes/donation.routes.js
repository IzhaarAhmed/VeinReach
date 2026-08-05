import { Router } from 'express';
import * as ctrl from '../controllers/donation.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { feedbackSchema } from '../validators/donation.schema.js';

const router = Router();

router.get('/', requireAuth, ctrl.history);
router.get('/:id', requireAuth, ctrl.getOne);
router.post('/:id/feedback', requireAuth, validate(feedbackSchema), ctrl.leaveFeedback);
router.get('/:id/certificate', requireAuth, ctrl.certificate);

export default router;
