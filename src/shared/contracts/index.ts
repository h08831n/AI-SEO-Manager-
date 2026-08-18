import { z } from 'zod';

// ==========================================
// DATA PROVENANCE CONTRACT
// ==========================================
export const DataSourceProvenanceSchema = z.enum([
  'MEASURED_REAL',
  'CALCULATED',
  'USER_PROVIDED',
  'ESTIMATED',
  'AI_INFERENCE',
  'DATA_UNAVAILABLE',
]);
export type DataSourceProvenance = z.infer<typeof DataSourceProvenanceSchema>;

export const DataProvenanceWrapperSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    provenance: DataSourceProvenanceSchema,
    sourceProvider: z.string(),
    retrievedAt: z.string(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    confidence: z.number().min(0).max(1),
    isEstimated: z.boolean(),
  });

// ==========================================
// EVIDENCE CONTEXT CONTRACT
// ==========================================
export const MetricEvidenceSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.string().optional(),
  provenance: DataSourceProvenanceSchema,
  sourceProvider: z.string(),
});
export type MetricEvidence = z.infer<typeof MetricEvidenceSchema>;

export const EvidenceContextSchema = z.object({
  domain: z.string(),
  verifiedWebsiteId: z.string().optional(),
  metrics: z.array(MetricEvidenceSchema).optional(),
  availableDataStreams: z.array(z.string()).optional(),
  unavailableDataStreams: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type EvidenceContext = z.infer<typeof EvidenceContextSchema>;

// ==========================================
// 1. CRAWL URL CONTRACT
// ==========================================
export const CrawlUrlRequestSchema = z.object({
  url: z.string().url('A valid HTTP or HTTPS URL is required'),
});
export type CrawlUrlRequest = z.infer<typeof CrawlUrlRequestSchema>;

export const CrawlIssueSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  message: z.string(),
  evidence: z.string(),
  impact: z.string(),
});
export type CrawlIssue = z.infer<typeof CrawlIssueSchema>;

export const CrawlUrlResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED', 'BLOCKED']),
  requestedUrl: z.string(),
  finalUrl: z.string(),
  redirectCount: z.number(),
  statusCode: z.number(),
  loadTimeMs: z.number(),
  isIndexable: z.boolean(),
  canonicalUrl: z.string().nullable(),
  canonicalMatch: z.boolean(),
  title: z.string().nullable(),
  titleLength: z.number(),
  metaDescription: z.string().nullable(),
  metaDescLength: z.number(),
  metaRobots: z.string().nullable(),
  xRobotsTag: z.string().nullable(),
  h1Tags: z.array(z.string()),
  h2Count: z.number(),
  wordCount: z.number(),
  internalInlinks: z.literal('DATA_UNAVAILABLE'), // Inlinks require site-wide graph analysis
  internalOutlinksCount: z.number(),
  externalOutlinksCount: z.number(),
  imagesCount: z.number(),
  missingAltCount: z.number(),
  schemaTypes: z.array(z.string()),
  issues: z.array(CrawlIssueSchema),
  crawledAt: z.string(),
  provenance: DataSourceProvenanceSchema,
});
export type CrawlUrlResponse = z.infer<typeof CrawlUrlResponseSchema>;

// ==========================================
// 2. COPILOT CONTRACT
// ==========================================
export const CopilotRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ).optional().default([]),
  evidenceContext: EvidenceContextSchema.optional(),
});
export type CopilotRequest = z.infer<typeof CopilotRequestSchema>;

export const CopilotResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'DATA_UNAVAILABLE', 'ERROR']),
  reply: z.string(),
  source: z.string(),
  reason: z.string().optional(),
  provenance: DataSourceProvenanceSchema,
  missingDataStreams: z.array(z.string()).optional(),
});
export type CopilotResponse = z.infer<typeof CopilotResponseSchema>;

// ==========================================
// 3. CONTENT BRIEF CONTRACT
// ==========================================
export const ContentBriefRequestSchema = z.object({
  targetKeyword: z.string().min(1, 'Target keyword is required'),
  topic: z.string().min(1, 'Topic is required'),
  targetAudience: z.string().optional().default('General Professional'),
  searchIntent: z.string().optional().default('Informational'),
});
export type ContentBriefRequest = z.infer<typeof ContentBriefRequestSchema>;

export const ContentBriefResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'DATA_UNAVAILABLE', 'ERROR']),
  targetKeyword: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  recommendedSlug: z.string(),
  searchIntent: z.string(),
  targetWordCount: z.number(),
  h1: z.string(),
  outline: z.array(
    z.object({
      section: z.string(),
      description: z.string(),
    })
  ),
  faq: z.array(
    z.object({
      question: z.string(),
      answerAngle: z.string(),
    })
  ),
  semanticEntities: z.array(z.string()),
  informationGainAngles: z.array(z.string()),
  internalLinkSuggestions: z.array(z.string()),
  schemaType: z.string(),
  imagePrompts: z.array(z.string()),
  provenance: DataSourceProvenanceSchema,
  reason: z.string().optional(),
});
export type ContentBriefResponse = z.infer<typeof ContentBriefResponseSchema>;

// ==========================================
// 4. CONTENT REFRESH CONTRACT
// ==========================================
export const ContentRefreshRequestSchema = z.object({
  targetUrl: z.string().min(1, 'Target URL is required'),
  currentTitle: z.string().min(1, 'Current title is required'),
  dropPercentage: z.number(),
  historicalClicks: z.number(),
  currentClicks: z.number(),
});
export type ContentRefreshRequest = z.infer<typeof ContentRefreshRequestSchema>;

export const ContentRefreshResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'DATA_UNAVAILABLE', 'ERROR']),
  url: z.string(),
  dropPercentage: z.number(),
  diagnosisSummary: z.string(),
  proposedNewTitle: z.string(),
  proposedNewMetaDescription: z.string(),
  missingTopics: z.array(z.string()),
  newFaqsToAdd: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),
  actionPlan: z.array(z.string()),
  provenance: DataSourceProvenanceSchema,
  reason: z.string().optional(),
});
export type ContentRefreshResponse = z.infer<typeof ContentRefreshResponseSchema>;

// ==========================================
// 5. CTR OPTIMIZATION CONTRACT
// ==========================================
export const CtrOptimizationRequestSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  currentTitle: z.string().min(1, 'Current title is required'),
  currentMetaDescription: z.string().min(1, 'Current meta description is required'),
  currentPosition: z.number(),
  currentCtr: z.number(),
});
export type CtrOptimizationRequest = z.infer<typeof CtrOptimizationRequestSchema>;

export const CtrVariationSchema = z.object({
  variantName: z.string(),
  title: z.string(),
  metaDescription: z.string(),
  strategicHypothesis: z.string(),
});
export type CtrVariation = z.infer<typeof CtrVariationSchema>;

export const CtrOptimizationResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'DATA_UNAVAILABLE', 'ERROR']),
  keyword: z.string(),
  currentPosition: z.number(),
  currentCtr: z.number(),
  variations: z.array(CtrVariationSchema),
  provenance: DataSourceProvenanceSchema,
  disclaimer: z.string(),
  reason: z.string().optional(),
});
export type CtrOptimizationResponse = z.infer<typeof CtrOptimizationResponseSchema>;

// ==========================================
// 6. SCHEMA GENERATOR CONTRACT
// ==========================================
export const SchemaGenerationRequestSchema = z.object({
  type: z.enum(['Article', 'FAQPage', 'Product', 'Organization', 'BreadcrumbList']),
  data: z.record(z.string(), z.any()),
});
export type SchemaGenerationRequest = z.infer<typeof SchemaGenerationRequestSchema>;

export const SchemaValidationStatusSchema = z.enum(['VALID', 'INVALID', 'NOT_VALIDATED']);
export type SchemaValidationStatus = z.infer<typeof SchemaValidationStatusSchema>;

export const SchemaGenerationResponseSchema = z.object({
  status: z.enum(['SUCCESS', 'ERROR']),
  schemaType: z.string(),
  schemaJsonLd: z.record(z.string(), z.any()),
  validationStatus: SchemaValidationStatusSchema,
  validationErrors: z.array(z.string()),
  validationWarnings: z.array(z.string()),
  provenance: DataSourceProvenanceSchema,
});
export type SchemaGenerationResponse = z.infer<typeof SchemaGenerationResponseSchema>;

// ==========================================
// 7. CSV EXPORT CONTRACT
// ==========================================
export const CSVExportRequestSchema = z.object({
  filename: z.string().default('export.csv'),
  rows: z.array(z.record(z.string(), z.any())),
});
export type CSVExportRequest = z.infer<typeof CSVExportRequestSchema>;

// ==========================================
// 8. INTEGRATION STATUS CONTRACT
// ==========================================
export const IntegrationStatusSchema = z.enum([
  'NOT_CONFIGURED',
  'CONNECTING',
  'CONNECTED',
  'DEGRADED',
  'ERROR',
  'DISCONNECTED',
  'REVOKED',
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const IntegrationConnectionSchema = z.object({
  provider: z.string(),
  status: IntegrationStatusSchema,
  lastSyncAt: z.string().nullable(),
  message: z.string(),
  accountIdentifier: z.string().nullable(),
});
export type IntegrationConnection = z.infer<typeof IntegrationConnectionSchema>;

// ==========================================
// 9. WORDPRESS PREVIEW & CONNECTION STATUS CONTRACT
// ==========================================
export const WordPressPreviewRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  slug: z.string().optional(),
  status: z.enum(['draft', 'publish']).default('draft'),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
export type WordPressPreviewRequest = z.infer<typeof WordPressPreviewRequestSchema>;

export const WordPressPreviewResponseSchema = z.object({
  status: z.enum(['WORDPRESS_PAYLOAD_PREVIEW', 'NOT_CONNECTED', 'ERROR']),
  connectionStatus: IntegrationStatusSchema,
  message: z.string(),
  payload: z.object({
    title: z.string(),
    content: z.string(),
    slug: z.string().optional(),
    status: z.string(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
  postId: z.null(), // Null because no real post is published
  provenance: DataSourceProvenanceSchema,
});
export type WordPressPreviewResponse = z.infer<typeof WordPressPreviewResponseSchema>;

// ==========================================
// 10. TASK & RECOMMENDATION CONTRACT
// ==========================================
export const ActionStatusSchema = z.enum([
  'RECOMMENDATION_ONLY',
  'SIMULATION_ONLY',
  'PENDING_APPROVAL',
  'QUEUED',
  'DRY_RUN_COMPLETED',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'VERIFIED',
  'REVERTED',
  'BLOCKED_NO_INTEGRATION',
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const AutomationRiskLevelSchema = z.enum([
  'LEVEL_0_READ_ONLY',
  'LEVEL_1_SAFE_AUTOMATION',
  'LEVEL_2_APPROVAL_REQUIRED',
  'LEVEL_3_HIGH_RISK',
]);
export type AutomationRiskLevel = z.infer<typeof AutomationRiskLevelSchema>;
