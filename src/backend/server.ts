import dotenv from 'dotenv';
// 🛠️ FIX 1: dotenv.config() MUST run before routes are imported 
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import priceRoutes from './routes/prices';

// 🚀 FIXED: Importing the explicit named router instance to bypass ESM default compilation issues
import { authRouter } from './routes/auth'; 

import adminRoutes from '../routes/admin';
import { initCronJobs } from '../tasks/cronSync';
import { prisma } from '../lib/db';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 🛡️ ENFORCED RUNTIME CONFIGURATION CHECK
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
  console.error('❌ CRITICAL CONFIGURATION FAULT: Missing mandatory environment profiles inside configuration registry.');
  process.exit(1);
}

// ==========================================
// SYSTEM DISPATCH ROUTERS
// ==========================================
// Single mounting point — authRouter handles all /api/auth/* paths cleanly.
// POST /api/auth/admin/login → router.post('/admin/login', ...)  ✅
// POST /api/auth/login       → router.post('/login', ...)        ✅
// POST /api/auth/register    → router.post('/register', ...)     ✅
app.use('/api/auth', authRouter);

import { publicRoutes } from './routes/public';
import { materialsRouter } from './routes/materials';

app.use('/api', priceRoutes);
app.use('/api', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/materials', materialsRouter);

import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌐 SERVE STATIC FRONTEND FILES IN PRODUCTION
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// 🛡️ FRONTEND SPA FALLBACK ROUTE
// This catches any non-API routes and sends them to React Router.
app.get('*', (req: Request, res: Response) => {
  // If the request is for an API route that wasn't found, don't send the HTML page.
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint Not Found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Structural Integrity Check Node
app.get('/api/health', (req: Request, res: Response) => {
  return res.json({ 
    status: 'online', 
    timestamp: new Date(),
    engine: 'Prisma Client Strict Native Core v5 Pure Matrix Stack'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Hardened, Modular NCCDB Data Bank Server active on port ${PORT}`);
  console.log("Total Price Records in Server DB:", await prisma.priceRecord.count());
  initCronJobs();
});