import { Router, Request, Response } from 'express';
import { IntegrationRepository } from '../repositories/integrationRepository';
import {
  WordPressPreviewRequestSchema,
  WordPressPreviewResponse,
  CSVExportRequestSchema,
} from '../../src/shared/contracts';

const router = Router();

// GET /api/integrations
router.get('/', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const list = await IntegrationRepository.listForWebsite(websiteId);
  return res.json({ integrations: list });
});

// GET /api/integrations/:provider/status
router.get('/:provider/status', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const status = await IntegrationRepository.getStatus(websiteId, req.params.provider);
  return res.json(status);
});

// POST /api/export-wordpress (Honest Payload Preview - NO false success!)
router.post('/export-wordpress', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const parseResult = WordPressPreviewRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid WordPress draft payload', details: parseResult.error.flatten() });
  }

  const wpStatus = await IntegrationRepository.getStatus(websiteId, 'WORDPRESS');

  const responsePayload: WordPressPreviewResponse = {
    status: 'WORDPRESS_PAYLOAD_PREVIEW',
    connectionStatus: wpStatus.status,
    message:
      wpStatus.status === 'CONNECTED'
        ? 'WordPress connection verified. Payload prepared for publishing queue.'
        : 'WordPress is NOT CONNECTED. Draft payload generated for local preview/manual import only.',
    payload: parseResult.data,
    postId: null, // Null because post is not actually published without live credentials
    provenance: 'USER_PROVIDED',
  };

  return res.json(responsePayload);
});

// POST /api/export-csv
router.post('/export-csv', (req: Request, res: Response) => {
  const parseResult = CSVExportRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid CSV export payload' });
  }

  const { filename, rows } = parseResult.data;
  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided for export' });
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header];
      const stringVal = val === null || val === undefined ? '' : String(val);
      const escaped = stringVal.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvLines.push(values.join(','));
  }

  const csvContent = csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csvContent);
});

// POST /api/export-sheets (Honest Sheets API response - NOT CONFIGURED)
router.post('/export-sheets', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const sheetsStatus = await IntegrationRepository.getStatus(websiteId, 'SHEETS');

  return res.status(501).json({
    status: 'NOT_CONFIGURED',
    connectionStatus: sheetsStatus.status,
    message: 'Google Sheets OAuth API integration is NOT CONFIGURED. Direct cloud spreadsheet synchronization is unavailable. Please download the dataset as CSV instead.',
    provenance: 'DATA_UNAVAILABLE',
  });
});

export default router;
