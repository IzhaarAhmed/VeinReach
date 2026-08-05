import { Router } from 'express';
import * as ctrl from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, ctrl.list);
router.post('/read-all', requireAuth, ctrl.markAllRead);
router.patch('/:id/read', requireAuth, ctrl.markRead);

export default router;
