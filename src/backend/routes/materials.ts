import express, { Request, Response } from 'express';
import { prisma } from '../../lib/db';
import { GoogleGenAI } from '@google/genai';
import { cosineSimilarity } from '../utils/semanticSimilarity';

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

router.post('/simulate-mapping', async (req: Request, res: Response): Promise<any> => {
  try {
    const rawLines: string[] = req.body.rawLines || [];
    if (!Array.isArray(rawLines)) {
      return res.status(400).json({ error: 'rawLines must be an array of strings' });
    }

    const masters = await prisma.masterMaterial.findMany({
      include: { aliases: true }
    });

    const results = [];

    // Clean masters map for quick phase 1 deterministic lookups
    const deterministicMap = new Map<string, any>();
    for (const master of masters) {
      deterministicMap.set(master.standardName.toLowerCase(), master);
      for (const alias of master.aliases) {
        deterministicMap.set(alias.aliasName.toLowerCase(), master);
      }
    }

    for (const raw of rawLines) {
      const cleanRaw = raw.trim();
      if (!cleanRaw) continue;

      const lowerRaw = cleanRaw.toLowerCase();

      // Phase 1: Deterministic Pass
      const exactMatch = deterministicMap.get(lowerRaw);
      if (exactMatch) {
        results.push({
          rawString: cleanRaw,
          matchedCode: exactMatch.materialCode,
          matchedName: exactMatch.standardName,
          confidence: 100,
          method: 'Deterministic'
        });
        continue;
      }

      // Phase 2: Semantic Pass
      let bestMatch = null;
      let highestScore = 0;

      try {
        const embedRes = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: cleanRaw,
        });

        const rawEmbedding = embedRes.embeddings?.[0]?.values;
        if (rawEmbedding) {
          for (const master of masters) {
            if (master.embedding && master.embedding.length === rawEmbedding.length) {
              const score = cosineSimilarity(rawEmbedding, master.embedding) * 100;
              if (score > highestScore) {
                highestScore = score;
                bestMatch = master;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Embedding failed for ${cleanRaw}:`, err);
      }

      if (bestMatch && highestScore > 0) {
        results.push({
          rawString: cleanRaw,
          matchedCode: bestMatch.materialCode,
          matchedName: bestMatch.standardName,
          confidence: Math.round(highestScore * 100) / 100,
          method: 'Semantic AI'
        });
      } else {
        results.push({
          rawString: cleanRaw,
          matchedCode: null,
          matchedName: 'Unmapped',
          confidence: 0,
          method: 'None'
        });
      }
    }

    return res.json(results);
  } catch (error: any) {
    console.error('Error in simulate-mapping:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

import { syncMasterMaterialRegistry } from '../../services/sheetSync';

router.post('/sync-sheet', async (req: Request, res: Response): Promise<any> => {
  try {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'spreadsheetId is required' });
    }

    // Call the sync function (this runs asynchronously and loops the rows)
    await syncMasterMaterialRegistry(spreadsheetId);

    return res.json({ success: true, message: `Successfully synced master registry from sheet ${spreadsheetId}` });
  } catch (error: any) {
    console.error('Error in sync-sheet:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync master registry sheet' });
  }
});

router.post('/sync-master', async (req: Request, res: Response): Promise<any> => {
  try {
    const sheetId = process.env.MASTER_REGISTRY_SHEET_ID;
    if (!sheetId) {
      return res.status(500).json({ error: 'MASTER_REGISTRY_SHEET_ID is not configured on the server.' });
    }
    await syncMasterMaterialRegistry(sheetId);
    return res.json({ success: true, message: `Successfully synced master registry` });
  } catch (error: any) {
    console.error('Error in sync-master:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync master registry sheet' });
  }
});

export const materialsRouter = router;
