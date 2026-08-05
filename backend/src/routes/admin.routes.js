import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { setRoleSchema, suspendSchema, reviewOrgSchema } from '../validators/admin.schema.js';
import { resolveReportSchema } from '../validators/report.schema.js';

const router = Router();

// Every admin route requires an authenticated admin.
router.use(requireAuth, requireRole('admin'));

router.get('/stats', ctrl.stats);
router.get('/trends', ctrl.trends);
router.get('/audit', ctrl.listAudit);

// Users
router.get('/users', ctrl.listUsers);
router.get('/users/:id', ctrl.getUser);
router.get('/users/:id/documents/:docId/url', ctrl.getUserDocumentUrl);
router.patch('/users/:id/role', validate(setRoleSchema), ctrl.setUserRole);
router.patch('/users/:id/suspension', validate(suspendSchema), ctrl.setSuspended);
router.post('/users/:id/verify-organization', validate(reviewOrgSchema), ctrl.reviewOrganization);

// Reports / moderation
router.get('/reports', ctrl.listReports);
router.get('/reports/:id', ctrl.getReport);
router.post('/reports/:id/resolve', validate(resolveReportSchema), ctrl.resolveReport);

export default router;
