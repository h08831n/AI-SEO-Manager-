import { Router, Request, Response } from 'express';
import { requireWebsiteAccess } from '../security/authMiddleware';
import { SerpExecutionService } from '../services/serp/serpExecutionService';
import { SerpRepository } from '../repositories/serpRepository';
import { SerpQueueProducer } from '../queues/serpQueueProducer';
import { prisma } from '../db/prisma';
import { SerpDevice } from '@prisma/client';

export const serpRoutes = Router();

// Trigger immediate SERP Check for a keyword
serpRoutes.post('/websites/:websiteId/keywords/:keywordId/check', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId, keywordId } = req.params;
    const { device = SerpDevice.DESKTOP, async: runAsync = false } = req.body;

    if (runAsync) {
      const jobId = await SerpQueueProducer.enqueueSerpCheck({
        jobType: 'SERP_KEYWORD_CHECK',
        websiteId,
        keywordId,
        device: device as SerpDevice,
      });
      return res.status(202).json({ success: true, queued: true, jobId });
    }

    const result = await SerpExecutionService.executeKeywordSerpCheck({
      websiteId,
      keywordId,
      device: device as SerpDevice,
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Trigger batch SERP check
serpRoutes.post('/websites/:websiteId/batch-check', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { keywordIds, device = SerpDevice.DESKTOP, async: runAsync = false } = req.body;

    if (!Array.isArray(keywordIds) || keywordIds.length === 0) {
      return res.status(400).json({ error: 'keywordIds array is required' });
    }

    if (runAsync) {
      const jobId = await SerpQueueProducer.enqueueSerpCheck({
        jobType: 'SERP_BATCH_DISPATCH',
        websiteId,
        keywordIds,
        device: device as SerpDevice,
      });
      return res.status(202).json({ success: true, queued: true, jobId });
    }

    const result = await SerpExecutionService.batchExecuteKeywordChecks(websiteId, keywordIds, device as SerpDevice);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get latest snapshot for a keyword
serpRoutes.get('/websites/:websiteId/keywords/:keywordId/snapshot', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { keywordId } = req.params;
    const { device = SerpDevice.DESKTOP } = req.query;

    const snapshot = await SerpRepository.getLatestSnapshot(keywordId, device as SerpDevice);
    if (!snapshot) {
      return res.status(404).json({ error: 'No SERP snapshot found for keyword' });
    }

    return res.json({ success: true, snapshot });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get rank history for a keyword
serpRoutes.get('/websites/:websiteId/keywords/:keywordId/history', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { keywordId } = req.params;
    const { device = SerpDevice.DESKTOP, days = 30 } = req.query;

    const history = await SerpRepository.getRankHistory(keywordId, device as SerpDevice, parseInt(days as string, 10));
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// List SERP events
serpRoutes.get('/websites/:websiteId/events', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { limit = 50 } = req.query;

    const events = await prisma.serpSnapshotEvent.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: {
        keyword: { select: { keyword: true, searchIntent: true, businessValue: true } },
      },
    });

    return res.json({ success: true, count: events.length, events });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
