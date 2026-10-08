import { Router, Request, Response } from 'express';
import { syncSupplierSheet } from '../services/sheetSync';
import { PrismaClient } from '@prisma/client';
import { provisionCustomSupplierSheet } from '../backend/utils/sheetProvisioner';

const prisma = new PrismaClient();
const router = Router();

router.post('/admin/suppliers/provision', async (req: Request, res: Response) => {
  try {
    const supplierData = req.body;
    if (!supplierData || !supplierData.companyName || !supplierData.email) {
      return res.status(400).json({ success: false, error: 'Missing required supplier details' });
    }

    // Call the Google Drive/Sheets provisioning helper
    const newSpreadsheetId = await provisionCustomSupplierSheet(supplierData);

    // Save the new ID into the database tracking feed
    const feed = await prisma.supplierFeed.upsert({
      where: { spreadsheetId: newSpreadsheetId },
      update: { isActive: true },
      create: { spreadsheetId: newSpreadsheetId }
    });

    res.status(200).json({
      success: true,
      message: 'Custom supplier sheet provisioned successfully',
      spreadsheetId: newSpreadsheetId,
      feed
    });
  } catch (error) {
    console.error('[AdminRoute] Provisioning error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Provisioning failed' });
  }
});

router.post('/admin/supplier-feed', async (req: Request, res: Response) => {
  try {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'Spreadsheet ID is required' });
    }
    const feed = await prisma.supplierFeed.upsert({
      where: { spreadsheetId },
      update: { isActive: true },
      create: { spreadsheetId }
    });
    
    // Trigger immediate sync for this new sheet
    await syncSupplierSheet(spreadsheetId);
    
    res.status(200).json({ success: true, feed, message: 'Supplier feed added and synced successfully.' });
  } catch (error) {
    console.error('[AdminRoute] Failed to add supplier feed:', error);
    res.status(500).json({ success: false, error: 'Failed to add supplier feed.' });
  }
});

router.post('/admin/sync', async (req: Request, res: Response) => {
  try {
    let spreadsheetIds: string[] = [];
    if (req.body?.spreadsheetId) {
      spreadsheetIds = [req.body.spreadsheetId];
    } else if (req.query?.spreadsheetId) {
      spreadsheetIds = [req.query.spreadsheetId as string];
    } else {
      const feeds = await prisma.supplierFeed.findMany({ where: { isActive: true } });
      spreadsheetIds = feeds.map(f => f.spreadsheetId);
    }

    console.log(`[AdminRoute] UI-triggered manual sync starting for target sheets: ${spreadsheetIds.join(', ')}`);
    
    for (const sheetId of spreadsheetIds) {
      await syncSupplierSheet(sheetId as string);
    }
    
    res.status(200).json({ success: true, message: 'Sync successfully executed.' });
  } catch (error) {
    console.error('[AdminRoute] UI sync failed:', error);
    res.status(500).json({ success: false, error: 'Failed to sync sheet.' });
  }
});

router.post('/sync-feeds', async (req: Request, res: Response) => {
  try {
    console.log('[AdminRoute] Manual override sync triggered.');
    
    // Allow passing custom sheet IDs via body, or fallback to the tracking list
    let sheetIds: string[] = [];
    if (req.body?.sheetIds && Array.isArray(req.body.sheetIds)) {
      sheetIds = req.body.sheetIds;
    } else {
      const feeds = await prisma.supplierFeed.findMany({ where: { isActive: true } });
      sheetIds = feeds.map(f => f.spreadsheetId);
    }
    
    const results = [];
    
    for (const sheetId of sheetIds) {
      if (sheetId && sheetId !== 'YOUR_SHEET_ID_HERE') {
         try {
           await syncSupplierSheet(sheetId);
           results.push({ sheetId, status: 'success' });
         } catch (err) {
           results.push({ sheetId, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
         }
      } else {
         results.push({ sheetId, status: 'skipped (placeholder or invalid ID)' });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Sync process completed',
      results
    });
  } catch (error) {
    console.error('[AdminRoute] Error during manual sync:', error);
    res.status(500).json({
      success: false,
      message: 'Sync process failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/admin/feeds', async (req: Request, res: Response) => {
  try {
    const feeds = await prisma.supplierFeed.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, feeds });
  } catch (error) {
    console.error('[AdminRoute] Failed to fetch feeds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier feeds.' });
  }
});

router.delete('/admin/submissions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.priceRecord.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Submission deleted successfully.' });
  } catch (error) {
    console.error('[AdminRoute] Failed to delete submission:', error);
    res.status(500).json({ success: false, error: 'Failed to delete submission.' });
  }
});

router.delete('/admin/feeds/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.supplierFeed.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Supplier feed deleted successfully.' });
  } catch (error) {
    console.error('[AdminRoute] Failed to delete feed:', error);
    res.status(500).json({ success: false, error: 'Failed to delete supplier feed.' });
  }
});

router.patch('/admin/feeds/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updatedFeed = await prisma.supplierFeed.update({
      where: { id },
      data: { isActive }
    });
    res.status(200).json({ success: true, feed: updatedFeed });
  } catch (error) {
    console.error('[AdminRoute] Failed to update feed:', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier feed.' });
  }
});

/**
 * 📊 GET /api/admin/analytics/activity
 * Provides comprehensive activity analytics and recent log streams.
 */
router.get('/admin/analytics/activity', async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalActivity = await prisma.activityLog.count();
    
    const recentLogs = await prisma.activityLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, name: true, role: true, lastLoginAt: true }
        }
      }
    });

    const loginCount = await prisma.activityLog.count({ where: { type: 'USER_LOGIN' } });
    const registerCount = await prisma.activityLog.count({ where: { type: 'USER_REGISTER' } });
    const googleLoginCount = await prisma.activityLog.count({ where: { type: 'GOOGLE_LOGIN' } });
    const adminLoginCount = await prisma.activityLog.count({ where: { type: 'ADMIN_LOGIN' } });

    res.status(200).json({
      success: true,
      summary: {
        totalUsers,
        totalActivity,
        loginCount,
        registerCount,
        googleLoginCount,
        adminLoginCount
      },
      logs: recentLogs
    });
  } catch (error: any) {
    console.error('[AdminRoute] Failed to fetch activity analytics:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch activity analytics.' });
  }
});

export default router;
