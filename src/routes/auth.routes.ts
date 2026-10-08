import { Router } from 'express';
import { discoverUser, registerManual, loginManual, authGoogle } from '../controllers/auth.controller';

const router = Router();

// Base prefix configured in app.ts will map this to /api/auth/...
router.post('/discover', discoverUser);
router.post('/register', registerManual);
router.post('/login', loginManual);
router.post('/google', authGoogle);

export default router;