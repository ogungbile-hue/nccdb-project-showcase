import { Router, Response } from 'express';
import { prisma } from '../../lib/db';
import { ApprovalStatus, PriceSourceType } from '@prisma/client';
import { requireAdmin, checkRole, AuthenticatedRequest } from '../middleware/auth';
import { DEFAULT_SYSTEM_AUDITOR_ID } from '../constants/system';

const router = Router();

// Helper: returns true only for strings that look like a standard UUID v4.
// Used to safely gate the approvedById FK write — display-name strings must
// never be written into a foreign-key column (causes Prisma P2003 violation).
const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// 🎯 Aligned strictly to core professional metrics per Phase 1 standards
const VALID_SOURCES: PriceSourceType[] = [
  'QS_REPORT',
  'MANUAL_ENTRY',
  'TENDER_RETURN',
  'MARKET_BULLETIN'
];

// P2: Server-side price ceiling — mirrors the client-side constant in ManualEntryForm.tsx.
// Defence-in-depth: rejects requests that bypass frontend validation.
const MAX_UNIT_PRICE_NGN = 25_000_000;

/**
 * GET /api/materials
 * Retrieves a list of all active materials registered in the system database.
 */
router.get('/materials', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const materials = await prisma.material.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return res.json(materials);
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

/**
 * GET /api/locations
 * Returns all active locations for contributor portal dropdowns. Open endpoint.
 */
router.get('/locations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: [{ zone: 'asc' }, { city: 'asc' }],
    });
    return res.json(locations);
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

/**
 * POST /api/prices
 * Handles ingestion, data duplication mapping, and registration of verified price logs.
 */
router.post('/prices', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("PAYLOAD RECEIVED:", JSON.stringify(req.body, null, 2));
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    const submittedById = req.user?.userId || (req.user as any)?.id || (req as any).userId;

    if (!submittedById || typeof submittedById !== 'string') {
      return res.status(400).json({ error: 'Validation failed: Unresolved active user session identifier.' });
    }

    if (entries.length === 0) {
      return res.status(400).json({ error: 'Validation failed: Payload must be a non-empty array of entries.' });
    }

    const createdRecords = [];

    for (const entry of entries) {
      const { materialId, locationId, city, zone, price, notes, sourceType, contributorId, status } = entry;

      if (!materialId || typeof materialId !== 'string') {
        return res.status(400).json({ error: 'Validation failed: A valid material identifier is required.' });
      }
      if (!locationId && (!city || !zone)) {
        return res.status(400).json({ error: 'Validation failed: A valid location identifier or city/zone pair is required.' });
      }
      if (price === undefined || price === null || typeof price !== 'number' || isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Validation failed: Price must be a positive numeric value.' });
      }
      if (price > MAX_UNIT_PRICE_NGN) {
        return res.status(400).json({ 
          error: `Validation failed: Price of ₦${price.toLocaleString()} exceeds the ₦25,000,000 maximum allowed per unit.` 
        });
      }
      if (!sourceType || !VALID_SOURCES.includes(sourceType as PriceSourceType)) {
        return res.status(400).json({ 
          error: `Validation failed: Invalid price source type.` 
        });
      }

      // Handle dynamic location upsert if locationId is omitted but city/zone are present
      let finalLocationId = locationId;
      if (!finalLocationId && city && zone) {
        const location = await prisma.location.upsert({
          where: { city_zone: { city, zone } },
          update: {},
          create: { city, zone },
        });
        finalLocationId = location.id;
      }

      // Handle composite contributor string Upsert
      let finalSubmittedById = submittedById;
      if (contributorId) {
        finalSubmittedById = contributorId;
        const parts = contributorId.split(' - ');
        const phone = parts[0] || '';
        const name = parts[1] || 'Unknown User';
        const email = parts[2] || `manual_${Date.now()}@nccdb.com`;
        
        try {
          await prisma.user.upsert({
            where: { id: contributorId },
            update: {},
            create: {
              id: contributorId,
              email: email,
              name: name,
              phoneNumber: phone,
              passwordHash: 'manual-sync-auto',
            }
          });
        } catch (err) {
          await prisma.user.upsert({
            where: { id: contributorId },
            update: {},
            create: {
              id: contributorId,
              email: `alias_manual_${Date.now()}_${Math.floor(Math.random() * 1000)}@nccdb.com`,
              name: name,
              phoneNumber: phone,
              passwordHash: 'manual-sync-auto',
            }
          });
        }
      }

      const resolvedSourceType = sourceType as PriceSourceType;
      const resolvedStatus = status === 'PENDING' ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const suspiciousDuplicate = await prisma.priceRecord.findFirst({
        where: {
          materialId,
          locationId: finalLocationId,
          price,
          sourceType: resolvedSourceType,
          timestamp: { gte: oneHourAgo },
          deletedAt: null
        }
      });

      const parsedNotes = suspiciousDuplicate 
        ? `[SYSTEM WARNING: Potential Duplicate Entry Detected within 1hr window] ${notes || ''}`.trim()
        : notes || null;

      const newPriceRecord = await prisma.priceRecord.create({
        data: {
          materialId,
          locationId: finalLocationId,
          price,
          sourceType: resolvedSourceType,
          status: resolvedStatus,
          notes: parsedNotes,
          submittedById: finalSubmittedById,
          timestamp: new Date(),
        },
        include: {
          material: true,
          location: true,
          submittedBy: { select: { name: true, email: true, phoneNumber: true } },
        }
      });
      
      createdRecords.push(newPriceRecord);
    }

    return res.status(201).json(Array.isArray(req.body) ? createdRecords : createdRecords[0]);
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

/**
 * 🔓 GET /api/prices
 * Fetches filtered cost records for audit evaluation.
 */
router.get('/prices', requireAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'CONTRIBUTOR' && userRole !== 'CONTRIBUTOR_QS') {
      return res.status(403).json({ error: 'Access denied: You do not possess the required data ledger visibility clearance.' });
    }

    const { materialId, locationId, startDate, endDate, status, sourceType } = req.query;

    let targetStatus: ApprovalStatus | undefined;
    if (typeof status === 'string' && status in ApprovalStatus) {
      targetStatus = ApprovalStatus[status as keyof typeof ApprovalStatus];
    }

    const whereClause: Record<string, any> = {
      deletedAt: null,
    };

    if (targetStatus) {
      whereClause.status = targetStatus;
    }

    if (userRole === 'CONTRIBUTOR_QS' || userRole === 'CONTRIBUTOR') {
      whereClause.OR = [
        { submittedById: req.user?.userId },
        { status: ApprovalStatus.APPROVED }
      ];
    }

    if (materialId) whereClause.materialId = String(materialId);
    if (locationId) whereClause.locationId = String(locationId);
    
    // Explicit source filtering baseline for the dashboard UI switches
    if (sourceType && VALID_SOURCES.includes(sourceType as PriceSourceType)) {
      whereClause.sourceType = sourceType as PriceSourceType;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, any> = {};
      if (startDate) {
        const parsedStart = new Date(String(startDate));
        if (!isNaN(parsedStart.getTime())) dateFilter.gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(String(endDate));
        if (!isNaN(parsedEnd.getTime())) dateFilter.lte = parsedEnd;
      }
      if (Object.keys(dateFilter).length > 0) {
        whereClause.timestamp = dateFilter;
      }
    }

    const prices = await prisma.priceRecord.findMany({
      where: whereClause,
      include: {
        material: true,
        location: true,
        // Fix 4: surface submitter contact metadata to the frontend
        submittedBy: { select: { name: true, email: true, phoneNumber: true } },
      },
      orderBy: { timestamp: 'desc' },
    });
    
    return res.json(prices);
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

/**
 * 🔓 PATCH /api/prices/:id/status
 * Updates the approval status and log notes for rapid audit processing.
 */
router.patch('/prices/:id/status', requireAdmin as any, checkRole(['SUPER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {

    const { id } = req.params;
    const { status, notes, moderatedById } = req.body;

    if (!status || !(status in ApprovalStatus)) {
      return res.status(400).json({ error: 'Validation failed: Provided workflow status state is invalid.' });
    }
    if (!moderatedById || typeof moderatedById !== 'string') {
      return res.status(400).json({ error: 'Validation failed: Auditor identifier signature is mandatory.' });
    }

    const currentRecord = await prisma.priceRecord.findUnique({ where: { id } });
    if (!currentRecord) {
      return res.status(404).json({ error: 'The requested pricing record could not be found.' });
    }

    let finalStatus = status as ApprovalStatus;
    let deviationRate: number | null = null;

    if (finalStatus === ApprovalStatus.APPROVED) {
      // Calculate historical baseline from the last 3 APPROVED records
      const lastApproved = await prisma.priceRecord.findMany({
        where: {
          materialId: currentRecord.materialId,
          locationId: currentRecord.locationId,
          status: ApprovalStatus.APPROVED,
          deletedAt: null,
          id: { not: currentRecord.id }
        },
        orderBy: { timestamp: 'desc' },
        take: 3
      });

      if (lastApproved.length > 0) {
        const sum = lastApproved.reduce((acc, rec) => acc + Number(rec.price), 0);
        const baseline = sum / lastApproved.length;
        const currentPrice = Number(currentRecord.price);
        
        // Calculate absolute variance delta percentage
        const delta = Math.abs((currentPrice - baseline) / baseline) * 100;
        deviationRate = delta;

        if (delta > 20) {
          // Hard-lock: Automatically override to FLAGGED
          finalStatus = ApprovalStatus.FLAGGED;
        } else if (delta > 10 && delta <= 20) {
          // Soft-lock: Require notes
          if (!notes || notes.trim() === '') {
            return res.status(400).json({ error: 'Validation failed: Variance > 10%. Administrator notes are mandatory to justify this approval.' });
          }
        }
      }
    }

    // Append automated warning note if system forcefully flagged it
    let systemNotes = notes || '';
    if (finalStatus === ApprovalStatus.FLAGGED && status === 'APPROVED') {
      systemNotes = `[SYSTEM OVERRIDE]: Variance delta exceeded 20% safe threshold. Forced to FLAGGED status. Original auditor note: ${notes || 'None'}`;
    }

    const updatedNotes = systemNotes 
      ? `[Moderated by ${moderatedById}]: ${systemNotes}\n${currentRecord.notes || ''}`.trim()
      : currentRecord.notes;

    const updatedPriceRecord = await prisma.priceRecord.update({
      where: { id },
      data: {
        status: finalStatus,
        notes: updatedNotes,
        deviationRate: deviationRate !== null ? deviationRate : undefined,
        // Fix 1: only write approvedById when status is APPROVED AND the
        // moderatedById value is a valid UUID — prevents FK constraint P2003
        // when the moderator field contains a display-name string.
        approvedById:
          finalStatus === ApprovalStatus.APPROVED && isUuid(moderatedById)
            ? moderatedById
            : null,
        approvedAt: finalStatus === ApprovalStatus.APPROVED ? new Date() : null,
      },
      include: {
        material: true,
        location: true,
        // Fix 4: surface submitter contact metadata to the frontend
        submittedBy: { select: { name: true, email: true, phoneNumber: true } },
      }
    });

    return res.json(updatedPriceRecord);
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

/**
 * 🔓 DELETE /api/prices/:id
 * Hard deletes or logically deletes a price record (used for Rejection).
 */
router.delete('/prices/:id', requireAdmin as any, checkRole(['SUPER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentRecord = await prisma.priceRecord.findUnique({ where: { id } });
    if (!currentRecord) {
      return res.status(404).json({ error: 'The requested pricing record could not be found.' });
    }
    
    await prisma.priceRecord.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Pricing record successfully rejected/deleted.' });
  } catch (error: any) {
    console.error('[PRICES ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'A database error occurred while processing your request.' 
    });
  }
});

export default router;