import { Router } from 'express';
import * as ctrl from '../controllers/stock.controller.js';
import { requireAuth, requireRole, requireVerifiedOrg } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  upsertStockSchema,
  publishShortageSchema,
  nearbyStockSchema,
} from '../validators/stock.schema.js';

const router = Router();

// Public discovery — any authenticated user can find nearby banks + shortages.
router.get('/nearby', requireAuth, validate(nearbyStockSchema, 'query'), ctrl.nearby);

// Blood-bank-only management (must be a verified organization to publish).
const bank = [requireAuth, requireRole('bloodbank')];
router.get('/me/stock', ...bank, ctrl.myStock);
router.put('/me/stock', ...bank, requireVerifiedOrg, validate(upsertStockSchema), ctrl.upsertStock);
router.post(
  '/me/shortage',
  ...bank,
  requireVerifiedOrg,
  validate(publishShortageSchema),
  ctrl.publishShortage
);

export default router;
