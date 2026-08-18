import { Router, Request, Response } from 'express';
import { CopilotRequestSchema } from '../../src/shared/contracts';
import { GeminiService } from '../services/ai/geminiService';

const router = Router();

// POST /api/copilot
router.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CopilotRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'ERROR',
        reply: 'Invalid request parameters',
        source: 'REQUEST_VALIDATOR',
        reason: 'VALIDATION_FAILED',
        provenance: 'DATA_UNAVAILABLE',
      });
    }

    const response = await GeminiService.answerCopilotQuestion(parseResult.data);
    return res.json(response);
  } catch (err: any) {
    console.error('Copilot route error:', err);
    return res.status(500).json({
      status: 'ERROR',
      reply: 'An unexpected error occurred processing your request.',
      source: 'SERVER_EXCEPTION',
      reason: err.message,
      provenance: 'DATA_UNAVAILABLE',
    });
  }
});

export default router;
