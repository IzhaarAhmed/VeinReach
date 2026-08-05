import { Router } from 'express';
import * as ctrl from '../controllers/meetup.controller.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMeetupSchema, respondMeetupSchema } from '../validators/meetup.schema.js';

const router = Router();

router.post('/', requireAuth, requireVerifiedEmail, validate(createMeetupSchema), ctrl.create);
router.get('/mine', requireAuth, ctrl.mine);
router.post('/:id/respond', requireAuth, validate(respondMeetupSchema), ctrl.respond);

export default router;
