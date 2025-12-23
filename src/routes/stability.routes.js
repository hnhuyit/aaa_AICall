import { Router } from 'express';
import { imageToVideo } from '../controllers/stability.controller.js';

const router = Router();

// Đăng ký route POST /image-to-video
router.post('/image-to-video', imageToVideo);

export default router;
