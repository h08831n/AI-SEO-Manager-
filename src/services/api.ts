import {
  CrawlUrlResponse,
  CopilotResponse,
  EvidenceContext,
  ContentBriefRequest,
  ContentBriefResponse,
  ContentRefreshRequest,
  ContentRefreshResponse,
  CtrOptimizationRequest,
  CtrOptimizationResponse,
  SchemaGenerationRequest,
  SchemaGenerationResponse,
  WordPressPreviewRequest,
  WordPressPreviewResponse,
  IntegrationConnection,
} from '../shared/contracts';

export async function crawlUrl(url: string): Promise<CrawlUrlResponse> {
  const response = await fetch('/api/crawl/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Crawl request failed' }));
    throw new Error(errorData.message || errorData.error || 'Crawl failed');
  }
  return response.json();
}

export async function getCrawlRuns(): Promise<{ runs: any[] }> {
  const response = await fetch('/api/crawl/runs');
  if (!response.ok) {
    throw new Error('Failed to fetch crawl runs');
  }
  return response.json();
}

export async function askCopilot(
  question: string,
  evidenceContext?: EvidenceContext
): Promise<CopilotResponse> {
  const response = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, evidenceContext }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ reply: 'Copilot request failed' }));
    return {
      status: 'ERROR',
      reply: errorData.reply || errorData.message || 'Copilot server request failed.',
      source: 'SERVER_ERROR',
      reason: errorData.reason || 'HTTP_ERROR',
      provenance: 'DATA_UNAVAILABLE',
    };
  }
  return response.json();
}

export async function generateBrief(req: ContentBriefRequest): Promise<ContentBriefResponse> {
  const response = await fetch('/api/content/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error('Brief generation failed');
  }
  return response.json();
}

export async function generateRefresh(req: ContentRefreshRequest): Promise<ContentRefreshResponse> {
  const response = await fetch('/api/content/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error('Refresh diagnosis failed');
  }
  return response.json();
}

export async function optimizeCtr(
  reqOrTitle: CtrOptimizationRequest | string,
  meta?: string,
  keyword?: string,
  position?: number,
  ctr?: number,
  impressions?: number
): Promise<CtrOptimizationResponse> {
  const payload: CtrOptimizationRequest =
    typeof reqOrTitle === 'string'
      ? {
          keyword: keyword || 'target keyword',
          currentTitle: reqOrTitle,
          currentMetaDescription: meta || '',
          currentPosition: position || 1,
          currentCtr: ctr || 1,
        }
      : reqOrTitle;
  const response = await fetch('/api/content/ctr-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('CTR optimization failed');
  }
  return response.json();
}

export async function generateSchema(
  typeOrReq: SchemaGenerationRequest | 'Article' | 'FAQPage' | 'Product' | 'Organization' | 'BreadcrumbList' | string,
  data?: Record<string, any>
): Promise<SchemaGenerationResponse> {
  const payload =
    typeof typeOrReq === 'string'
      ? { type: typeOrReq as any, data: data || {} }
      : typeOrReq;
  const response = await fetch('/api/content/schema-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Schema generation failed');
  }
  return response.json();
}

export async function exportToCsv(rows: any[], filename = 'seo_export.csv'): Promise<void> {
  const response = await fetch('/api/integrations/export-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, rows }),
  });
  if (!response.ok) {
    throw new Error('CSV export failed');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportToWordPress(payload: {
  title: string;
  content: string;
  slug?: string;
  status?: 'draft' | 'publish';
  categories?: string[];
  tags?: string[];
}): Promise<WordPressPreviewResponse> {
  const response = await fetch('/api/integrations/export-wordpress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('WordPress request failed');
  }
  return response.json();
}

export async function previewWordPressPayload(payload: WordPressPreviewRequest): Promise<WordPressPreviewResponse> {
  return exportToWordPress(payload);
}

export async function getWebsites(): Promise<any> {
  const res = await fetch('/api/websites');
  if (!res.ok) throw new Error('Failed to load websites');
  return res.json();
}

export async function getIntegrations(): Promise<{ integrations: IntegrationConnection[] }> {
  const res = await fetch('/api/integrations');
  if (!res.ok) throw new Error('Failed to load integrations');
  return res.json();
}

export async function getTasks(): Promise<any> {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Failed to load tasks');
  return res.json();
}

export async function getRecommendations(): Promise<any> {
  const res = await fetch('/api/tasks/recommendations');
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function executeTask(
  taskId: string,
  idempotencyKey: string,
  isSimulation = false
): Promise<any> {
  const res = await fetch(`/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey, isSimulation }),
  });
  if (!res.ok) throw new Error('Task execution request failed');
  return res.json();
}

export async function getAuditLogs(): Promise<any> {
  const res = await fetch('/api/tasks/audit-logs');
  if (!res.ok) throw new Error('Failed to load audit logs');
  return res.json();
}

export async function getObservabilityStatus(): Promise<any> {
  const res = await fetch('/api/observability/status');
  if (!res.ok) throw new Error('Failed to load observability status');
  return res.json();
}
