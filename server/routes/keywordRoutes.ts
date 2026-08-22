import { Router, Request, Response } from 'express';
import { requireWebsiteAccess } from '../security/authMiddleware';
import { KeywordRepository } from '../repositories/keywordRepository';
import { SeoEntityRepository } from '../repositories/seoEntityRepository';
import { KeywordDiscoveryPipeline } from '../services/serp/keywordDiscoveryPipeline';
import { IntentClassifierService } from '../services/serp/intentClassifierService';
import { prisma } from '../db/prisma';

export const keywordRoutes = Router();

// ==========================================
// 1. Keyword Universe Endpoints
// ==========================================

// List keywords for a website
keywordRoutes.get('/websites/:websiteId', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { trackingStatus, searchIntent, funnelStage, businessValue, moneyKeyword, query, limit, offset } = req.query;

    const result = await KeywordRepository.listKeywords(websiteId, {
      trackingStatus: trackingStatus as any,
      searchIntent: searchIntent as any,
      funnelStage: funnelStage as any,
      businessValue: businessValue as any,
      moneyKeyword: moneyKeyword !== undefined ? moneyKeyword === 'true' : undefined,
      query: query as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create single keyword with automatic intent classification
keywordRoutes.post('/websites/:websiteId', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { keyword, topicEntityId, conversionGoal, targetUrl, priority, tags } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    const classification = IntentClassifierService.classify(keyword, website?.domain);

    const result = await KeywordRepository.upsertKeyword({
      websiteId,
      keyword,
      searchIntent: req.body.searchIntent || classification.searchIntent,
      intentConfidence: classification.intentConfidence,
      funnelStage: req.body.funnelStage || classification.funnelStage,
      businessValue: req.body.businessValue || classification.businessValue,
      conversionIntent: req.body.conversionIntent !== undefined ? req.body.conversionIntent : classification.conversionIntent,
      moneyKeyword: req.body.moneyKeyword !== undefined ? req.body.moneyKeyword : classification.moneyKeyword,
      topicEntityId,
      conversionGoal: conversionGoal || classification.conversionGoal,
      targetUrl,
      priority,
      tags,
      searchVolume: req.body.searchVolume,
      cpc: req.body.cpc,
      competitionIndex: req.body.competitionIndex,
      discoverySource: 'MANUAL_SEED',
    });

    return res.status(201).json({ success: true, keyword: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Batch create / upsert keywords
keywordRoutes.post('/websites/:websiteId/batch', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { keywords } = req.body;

    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array' });
    }

    const results = await KeywordRepository.batchUpsertKeywords(websiteId, keywords);
    return res.status(201).json({ success: true, count: results.length, keywords: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Discovery: Ingest from GSC Search Queries
keywordRoutes.post('/websites/:websiteId/discover/gsc', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { minImpressions = 10, limit = 50 } = req.body;

    const result = await KeywordDiscoveryPipeline.discoverFromGsc(websiteId, minImpressions, limit);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Discovery: Extract from Crawled Pages
keywordRoutes.post('/websites/:websiteId/discover/crawl', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { limit = 50 } = req.body;

    const result = await KeywordDiscoveryPipeline.discoverFromCrawl(websiteId, limit);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Discovery: Import seed array
keywordRoutes.post('/websites/:websiteId/discover/seeds', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { seeds } = req.body;

    if (!Array.isArray(seeds)) {
      return res.status(400).json({ error: 'Seeds must be an array of strings' });
    }

    const result = await KeywordDiscoveryPipeline.importSeeds(websiteId, seeds);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single keyword details
keywordRoutes.get('/websites/:websiteId/:keywordId', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId, keywordId } = req.params;
    const keyword = await KeywordRepository.getKeywordById(keywordId, websiteId);
    if (!keyword) {
      return res.status(404).json({ error: `Keyword '${keywordId}' not found` });
    }
    return res.json({ success: true, keyword });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update keyword
keywordRoutes.patch('/websites/:websiteId/:keywordId', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId, keywordId } = req.params;
    const updated = await KeywordRepository.updateKeyword(keywordId, websiteId, req.body);
    return res.json({ success: true, keyword: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete keyword
keywordRoutes.delete('/websites/:websiteId/:keywordId', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId, keywordId } = req.params;
    await KeywordRepository.deleteKeyword(keywordId, websiteId);
    return res.json({ success: true, message: `Keyword '${keywordId}' deleted successfully` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. SEO Entity Graph Endpoints
// ==========================================

keywordRoutes.get('/websites/:websiteId/entities/all', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const entities = await SeoEntityRepository.listEntities(websiteId);
    return res.json({ success: true, entities });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

keywordRoutes.post('/websites/:websiteId/entities', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { name, slug, entityType, description, targetConversionGoal, pillarUrl, businessValue } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Entity name is required' });
    }

    const entity = await SeoEntityRepository.createEntity({
      websiteId,
      name,
      slug,
      entityType,
      description,
      targetConversionGoal,
      pillarUrl,
      businessValue,
    });

    return res.status(201).json({ success: true, entity });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
