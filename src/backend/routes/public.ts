import { Router } from 'express';
import { prisma } from '../../lib/db';

export const publicRoutes = Router();

/**
 * GET /api/public/search
 * Fetches materials by name (fuzzy search).
 * Filters strictly by { status: 'APPROVED' }.
 */
publicRoutes.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const priceRecords = await prisma.priceRecord.findMany({
      where: {
        status: 'APPROVED',
        material: {
          name: {
            contains: q,
            mode: 'insensitive'
          }
        }
      },
      include: {
        material: {
          include: { category: true }
        },
        location: true
      },
      take: 50,
      orderBy: { timestamp: 'desc' }
    });

    res.json(priceRecords);
  } catch (error) {
    console.error('[Public API] Search Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/public/analytics/regional/:materialId
 * Computes _avg, _min, _max of the price records grouped by Location.zone.
 * Since Prisma groupBy cannot directly group by relation fields (Location.zone),
 * we group by locationId first using Prisma, then map to zones.
 */
publicRoutes.get('/analytics/regional/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    // Utilize Prisma's groupBy feature to aggregate _avg, _min, _max by locationId
    const groupedByLocation = await prisma.priceRecord.groupBy({
      by: ['locationId'],
      where: {
        materialId,
        status: 'APPROVED'
      },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true }
    });

    if (groupedByLocation.length === 0) {
      return res.json([]);
    }

    const locationIds = groupedByLocation.map(g => g.locationId);
    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } }
    });

    // Map locationId to zone
    const locationZoneMap: Record<string, string> = {};
    locations.forEach(loc => {
      locationZoneMap[loc.id] = loc.zone;
    });

    // Consolidate location-level aggregations into zone-level
    const zoneMap: Record<string, { sumAvg: number; min: number; max: number; count: number; dataPoints: number }> = {};

    groupedByLocation.forEach(group => {
      const zone = locationZoneMap[group.locationId];
      if (!zone) return;

      const avgPrice = Number(group._avg.price || 0);
      const minPrice = Number(group._min.price || 0);
      const maxPrice = Number(group._max.price || 0);
      const dataPoints = group._count._all;

      if (!zoneMap[zone]) {
        zoneMap[zone] = { sumAvg: avgPrice, min: minPrice, max: maxPrice, count: 1, dataPoints };
      } else {
        zoneMap[zone].sumAvg += avgPrice;
        zoneMap[zone].count += 1;
        zoneMap[zone].dataPoints += dataPoints;
        if (minPrice < zoneMap[zone].min) zoneMap[zone].min = minPrice;
        if (maxPrice > zoneMap[zone].max) zoneMap[zone].max = maxPrice;
      }
    });

    const results = Object.keys(zoneMap).map(zone => {
      const stats = zoneMap[zone];
      return {
        zone,
        averagePrice: stats.sumAvg / stats.count, // Average of averages
        minPrice: stats.min,
        maxPrice: stats.max,
        dataPoints: stats.dataPoints
      };
    });

    res.json(results);
  } catch (error) {
    console.error('[Public API] Regional Analytics Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/public/analytics/trends/:materialId
 * Time-series data mapping how a material's price fluctuates over time.
 */
publicRoutes.get('/analytics/trends/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;

    // Fetch the last 100 approved records, sorted chronologically
    const records = await prisma.priceRecord.findMany({
      where: {
        materialId,
        status: 'APPROVED'
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: 100
    });

    // Map into a lightweight time-series format suitable for Recharts
    const trends = records.map(r => ({
      date: r.timestamp.toISOString().split('T')[0], // YYYY-MM-DD
      price: Number(r.price)
    }));

    res.json(trends);
  } catch (error) {
    console.error('[Public API] Trends Analytics Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
