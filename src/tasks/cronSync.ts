import cron from 'node-cron';
import { syncSupplierSheet } from '../services/sheetSync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const initCronJobs = () => {
  console.log('[CronSync] Initializing cron jobs...');
  
  // Schedule a standard midnight cron job
  cron.schedule('0 0 * * *', async () => {
    console.log('[CronSync] Starting scheduled midnight sync...');
    
    try {
      const activeFeeds = await prisma.supplierFeed.findMany({ where: { isActive: true } });
      const sheetIds = activeFeeds.map(f => f.spreadsheetId);

      for (const sheetId of sheetIds) {
        if (sheetId && sheetId !== 'YOUR_SHEET_ID_HERE') {
          try {
            await syncSupplierSheet(sheetId);
          } catch (error) {
            console.error(`[CronSync] Failed to sync sheet ${sheetId}:`, error);
          }
        }
      }
    } catch (err) {
      console.error('[CronSync] Failed to fetch active feeds from database:', err);
    }
    
    console.log('[CronSync] Scheduled sync completed.');
  });
  
  console.log('[CronSync] Cron jobs initialized successfully.');
};
