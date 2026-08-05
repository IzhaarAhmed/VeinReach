import { Router } from 'express';
import * as ctrl from '../controllers/report.controller.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReportSchema } from '../validators/report.schema.js';

const router = Router();

// Users raise reports; admins review them under /admin/reports.
router.post('/', requireAuth, requireVerifiedEmail, validate(createReportSchema), ctrl.create);
router.get('/mine', requireAuth, ctrl.mine);

export default router;
