import { Router } from 'express';
import * as ctrl from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { presignSchema } from '../validators/upload.schema.js';

const router = Router();

// Client asks for a presigned PUT URL, uploads directly to R2, then attaches
// the returned key via the relevant resource endpoint (e.g. /users/me/avatar).
router.post('/presign', requireAuth, validate(presignSchema), ctrl.presign);

export default router;
