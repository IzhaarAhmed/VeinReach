import { Router } from 'express';
import * as ctrl from '../controllers/geo.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { hospitalSearchSchema } from '../validators/geo.schema.js';

const router = Router();

// Auth required so the endpoint isn't an open geocoding proxy.
router.get('/hospitals', requireAuth, validate(hospitalSearchSchema, 'query'), ctrl.hospitals);

export default router;
