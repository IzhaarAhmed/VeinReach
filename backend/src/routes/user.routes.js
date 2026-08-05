import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateMeSchema,
  updateDonorProfileSchema,
  fcmTokenSchema,
} from '../validators/user.schema.js';
import { setAvatarSchema, addDocumentSchema } from '../validators/upload.schema.js';

const router = Router();

router.patch('/me', requireAuth, validate(updateMeSchema), ctrl.updateMe);
router.put('/me/avatar', requireAuth, validate(setAvatarSchema), ctrl.setAvatar);
router.post('/me/documents', requireAuth, validate(addDocumentSchema), ctrl.addDocument);
router.get('/me/documents/:docId/url', requireAuth, ctrl.getDocumentUrl);
router.post('/me/fcm-token', requireAuth, validate(fcmTokenSchema), ctrl.addFcmToken);
router.delete('/me/fcm-token', requireAuth, validate(fcmTokenSchema), ctrl.removeFcmToken);
router.patch(
  '/me/donor',
  requireAuth,
  requireRole('donor'),
  validate(updateDonorProfileSchema),
  ctrl.updateDonorProfile
);

export default router;
