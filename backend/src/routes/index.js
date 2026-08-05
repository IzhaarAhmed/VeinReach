import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import requestRoutes from './request.routes.js';
import geoRoutes from './geo.routes.js';
import meetupRoutes from './meetup.routes.js';
import notificationRoutes from './notification.routes.js';
import donationRoutes from './donation.routes.js';
import chatRoutes from './chat.routes.js';
import uploadRoutes from './upload.routes.js';
import reportRoutes from './report.routes.js';
import adminRoutes from './admin.routes.js';
import stockRoutes from './stock.routes.js';
import hospitalRoutes from './hospital.routes.js';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({ success: true, data: { status: 'ok' }, message: 'VeinReach API' })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/requests', requestRoutes);
router.use('/geo', geoRoutes);
router.use('/meetups', meetupRoutes);
router.use('/notifications', notificationRoutes);
router.use('/donations', donationRoutes);
router.use('/chat', chatRoutes);
router.use('/uploads', uploadRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/bloodbanks', stockRoutes);
router.use('/hospital', hospitalRoutes);

export default router;
