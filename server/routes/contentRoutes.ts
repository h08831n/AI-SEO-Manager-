import { Router, Request, Response } from 'express';
import {
  ContentBriefRequestSchema,
  ContentRefreshRequestSchema,
  CtrOptimizationRequestSchema,
  SchemaGenerationRequestSchema,
} from '../../src/shared/contracts';
import { GeminiService } from '../services/ai/geminiService';

const router = Router();

// POST /api/content/brief (or /api/generate-content-brief)
router.post('/brief', async (req: Request, res: Response) => {
  try {
    const parseResult = ContentBriefRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }
    const result = await GeminiService.generateContentBrief(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/content/refresh (or /api/generate-refresh-plan)
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const parseResult = ContentRefreshRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }
    const result = await GeminiService.generateContentRefresh(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/content/ctr-optimize (or /api/optimize-ctr)
router.post('/ctr-optimize', async (req: Request, res: Response) => {
  try {
    const parseResult = CtrOptimizationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }
    const result = await GeminiService.optimizeCtr(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/schema/generate (or /api/generate-schema)
router.post('/schema-generate', async (req: Request, res: Response) => {
  try {
    const parseResult = SchemaGenerationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    }
    const result = GeminiService.generateAndValidateSchema(parseResult.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
