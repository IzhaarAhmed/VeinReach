import { Router } from 'express';
import * as ctrl from '../controllers/chat.controller.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startConversationSchema,
  sendMessageSchema,
  listMessagesSchema,
} from '../validators/chat.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/conversations', ctrl.listConversations);
router.post('/conversations', validate(startConversationSchema), ctrl.startConversation);
router.get('/conversations/:id/messages', validate(listMessagesSchema, 'query'), ctrl.listMessages);
router.post(
  '/conversations/:id/messages',
  requireVerifiedEmail,
  validate(sendMessageSchema),
  ctrl.sendMessage
);
router.post('/conversations/:id/read', ctrl.markRead);
router.get('/conversations/:id/contact', ctrl.getContact);
router.post('/conversations/:id/consent', ctrl.consentContact);

export default router;
