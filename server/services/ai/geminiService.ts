import { GoogleGenAI } from '@google/genai';
import {
  CopilotRequest,
  CopilotResponse,
  ContentBriefRequest,
  ContentBriefResponse,
  ContentRefreshRequest,
  ContentRefreshResponse,
  CtrOptimizationRequest,
  CtrOptimizationResponse,
  SchemaGenerationRequest,
  SchemaGenerationResponse,
} from '../../../src/shared/contracts';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIClient;
}

export class GeminiService {
  /**
   * AI Senior SEO Director Copilot
   */
  public static async answerCopilotQuestion(req: CopilotRequest): Promise<CopilotResponse> {
    const ai = getGenAI();

    if (!ai) {
      return {
        status: 'DATA_UNAVAILABLE',
        reply:
          'AI Copilot is currently unavailable because the GEMINI_API_KEY environment variable is not configured on this server. To enable real AI reasoning, configure GEMINI_API_KEY in the AI Studio settings.',
        source: 'SYSTEM_STATUS',
        reason: 'LLM_PROVIDER_UNAVAILABLE',
        provenance: 'DATA_UNAVAILABLE',
        missingDataStreams: ['GEMINI_API_KEY'],
      };
    }

    try {
      const evidence = req.evidenceContext;
      const evidenceSummary = evidence
        ? `
Website Domain: ${evidence.domain}
Available Data Streams: ${evidence.availableDataStreams.join(', ') || 'None connected'}
Unavailable Streams: ${evidence.unavailableDataStreams.join(', ') || 'None'}
Direct Evidence Metrics:
${evidence.metrics.map((m) => `- ${m.label}: ${m.value !== null ? m.value : 'DATA_UNAVAILABLE'} (${m.provenance})`).join('\n')}
`
        : 'No specific website evidence context supplied with this question.';

      const systemInstruction = `
You are the AI Senior SEO Director & Technical Strategist for an enterprise Autonomous SEO Operating System.
You provide objective, mathematically precise, evidence-grounded SEO guidance.

CRITICAL RULES:
1. Do NOT invent or hallucinate metrics that were not provided in the evidence context.
2. If data is missing or marked DATA_UNAVAILABLE (e.g. GSC not connected, no crawl data), state clearly that the metric is unavailable and explain what data source is required.
3. Distinguish between MEASURED_REAL facts, CALCULATED metrics, and AI_INFERENCE recommendations.
4. Provide structured, actionable, senior-level recommendations with specific rationale, technical implementation steps, and risk levels.
`;

      const prompt = `
Context:
${evidenceSummary}

User Question:
"${req.question}"

Please provide your strategic diagnosis and action recommendations based on real SEO fundamentals and the evidence provided above.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const replyText = response.text || 'Unable to generate analysis response.';

      return {
        status: 'SUCCESS',
        reply: replyText,
        source: 'Gemini 3.7 Flash Reasoning Engine',
        provenance: 'AI_INFERENCE',
      };
    } catch (err: any) {
      console.error('Copilot Gemini error:', err);
      return {
        status: 'ERROR',
        reply: `AI analysis failed due to provider error: ${err.message || 'Unknown error'}. Please check API quota and network status.`,
        source: 'GEMINI_API_ERROR',
        reason: err.message,
        provenance: 'DATA_UNAVAILABLE',
      };
    }
  }

  /**
   * AI Content Brief Generator
   */
  public static async generateContentBrief(req: ContentBriefRequest): Promise<ContentBriefResponse> {
    const ai = getGenAI();

    if (!ai) {
      return {
        status: 'DATA_UNAVAILABLE',
        targetKeyword: req.targetKeyword,
        seoTitle: `${req.targetKeyword}: Technical Guide`,
        metaDescription: `Comprehensive guide covering ${req.topic}.`,
        recommendedSlug: req.targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        searchIntent: req.searchIntent || 'Informational',
        targetWordCount: 2000,
        h1: `${req.targetKeyword.toUpperCase()}: Complete Architecture & Implementation`,
        outline: [
          { section: '1. Introduction & Overview', description: `Define the core challenges of ${req.topic}.` },
          { section: '2. Core Architecture & Concepts', description: 'Deep technical breakdown of foundational components.' },
          { section: '3. Production Implementation Patterns', description: 'Step-by-step code and workflow guide.' },
          { section: '4. Best Practices & Pitfalls', description: 'Common failure modes and how to avoid them.' },
        ],
        faq: [
          { question: `What is the primary benefit of ${req.targetKeyword}?`, answerAngle: 'Explain operational efficiency and business ROI.' },
        ],
        semanticEntities: [req.targetKeyword, req.topic],
        informationGainAngles: ['First-party benchmark data', 'Practical real-world troubleshooting steps'],
        internalLinkSuggestions: ['/guides/architecture-overview', '/blog/getting-started'],
        schemaType: 'TechArticle',
        imagePrompts: [`Architectural diagram explaining ${req.topic}`],
        provenance: 'DATA_UNAVAILABLE',
        reason: 'GEMINI_API_KEY is not configured. Returning deterministic structural template.',
      };
    }

    try {
      const prompt = `
Generate an enterprise-grade 12-dimensional SEO Content Brief for:
- Primary Target Keyword: "${req.targetKeyword}"
- Topic: "${req.topic}"
- Target Audience: "${req.targetAudience}"
- Search Intent: "${req.searchIntent}"

Return JSON matching this exact schema:
{
  "seoTitle": "High CTR title under 60 chars",
  "metaDescription": "Compelling meta description under 155 chars with primary keyword and CTA",
  "recommendedSlug": "keyword-slug",
  "searchIntent": "${req.searchIntent}",
  "targetWordCount": 2200,
  "h1": "Comprehensive H1 Title",
  "outline": [
    { "section": "1. Section Heading", "description": "Specific coverage instructions and subtopics" }
  ],
  "faq": [
    { "question": "Key FAQ Question?", "answerAngle": "Precise answer guidance" }
  ],
  "semanticEntities": ["Entity1", "Entity2", "Entity3"],
  "informationGainAngles": ["Proprietary benchmark", "Novel comparison"],
  "internalLinkSuggestions": ["/topic/subtopic-1", "/topic/subtopic-2"],
  "schemaType": "TechArticle",
  "imagePrompts": ["Technical diagram showing workflow"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      return {
        status: 'SUCCESS',
        targetKeyword: req.targetKeyword,
        seoTitle: parsed.seoTitle || `${req.targetKeyword}: Strategic Guide`,
        metaDescription: parsed.metaDescription || `In-depth analysis of ${req.topic}.`,
        recommendedSlug: parsed.recommendedSlug || req.targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        searchIntent: parsed.searchIntent || req.searchIntent || 'Informational',
        targetWordCount: parsed.targetWordCount || 2000,
        h1: parsed.h1 || `${req.targetKeyword}: Comprehensive Overview`,
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
        faq: Array.isArray(parsed.faq) ? parsed.faq : [],
        semanticEntities: Array.isArray(parsed.semanticEntities) ? parsed.semanticEntities : [],
        informationGainAngles: Array.isArray(parsed.informationGainAngles) ? parsed.informationGainAngles : [],
        internalLinkSuggestions: Array.isArray(parsed.internalLinkSuggestions) ? parsed.internalLinkSuggestions : [],
        schemaType: parsed.schemaType || 'Article',
        imagePrompts: Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts : [],
        provenance: 'AI_INFERENCE',
      };
    } catch (err: any) {
      console.error('Content Brief error:', err);
      return {
        status: 'ERROR',
        targetKeyword: req.targetKeyword,
        seoTitle: `${req.targetKeyword}: Overview`,
        metaDescription: `Guide covering ${req.topic}.`,
        recommendedSlug: req.targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        searchIntent: req.searchIntent || 'Informational',
        targetWordCount: 2000,
        h1: `${req.targetKeyword}`,
        outline: [],
        faq: [],
        semanticEntities: [],
        informationGainAngles: [],
        internalLinkSuggestions: [],
        schemaType: 'Article',
        imagePrompts: [],
        provenance: 'DATA_UNAVAILABLE',
        reason: err.message,
      };
    }
  }

  /**
   * AI Content Decay Refresh Planner
   */
  public static async generateContentRefresh(req: ContentRefreshRequest): Promise<ContentRefreshResponse> {
    const ai = getGenAI();

    if (!ai) {
      return {
        status: 'DATA_UNAVAILABLE',
        url: req.targetUrl,
        dropPercentage: req.dropPercentage,
        diagnosisSummary: `Content at ${req.targetUrl} experienced a ${req.dropPercentage}% organic traffic decline. AI diagnosis engine is offline.`,
        proposedNewTitle: `${req.currentTitle} (Updated Implementation Guide)`,
        proposedNewMetaDescription: `Updated technical guide for ${req.currentTitle}. Learn new production patterns and benchmarks.`,
        missingTopics: ['Modern best practices', 'Current architectural benchmarks'],
        newFaqsToAdd: [{ question: 'What changed in the latest standard?', answer: 'Detailed summary of recent architectural developments.' }],
        actionPlan: [
          'Audit current competitor SERP results for intent shifts',
          'Add missing technical sections and updated benchmarks',
          'Refresh title tag and meta description',
          'Verify internal inlinks',
        ],
        provenance: 'DATA_UNAVAILABLE',
        reason: 'GEMINI_API_KEY is not configured.',
      };
    }

    try {
      const prompt = `
Analyze decaying content:
- URL: "${req.targetUrl}"
- Current Title: "${req.currentTitle}"
- Traffic Drop: -${req.dropPercentage}%
- Historical Clicks: ${req.historicalClicks}
- Current Clicks: ${req.currentClicks}

Diagnose why this content likely decayed (outdated terminology, intent drift, competitor content depth) and produce a targeted refresh plan.

Return JSON matching:
{
  "diagnosisSummary": "2-3 sentence technical diagnosis of the traffic drop",
  "proposedNewTitle": "Refreshed high-CTR title under 60 chars",
  "proposedNewMetaDescription": "Updated meta description under 155 chars",
  "missingTopics": ["Topic 1", "Topic 2", "Topic 3"],
  "newFaqsToAdd": [
    { "question": "Question 1", "answer": "Answer summary" }
  ],
  "actionPlan": [
    "Step 1", "Step 2", "Step 3", "Step 4"
  ]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      return {
        status: 'SUCCESS',
        url: req.targetUrl,
        dropPercentage: req.dropPercentage,
        diagnosisSummary: parsed.diagnosisSummary || `Diagnosed traffic decline of ${req.dropPercentage}% on ${req.targetUrl}.`,
        proposedNewTitle: parsed.proposedNewTitle || req.currentTitle,
        proposedNewMetaDescription: parsed.proposedNewMetaDescription || 'Updated guide with latest industry benchmarks.',
        missingTopics: Array.isArray(parsed.missingTopics) ? parsed.missingTopics : [],
        newFaqsToAdd: Array.isArray(parsed.newFaqsToAdd) ? parsed.newFaqsToAdd : [],
        actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan : [],
        provenance: 'AI_INFERENCE',
      };
    } catch (err: any) {
      console.error('Content Refresh error:', err);
      return {
        status: 'ERROR',
        url: req.targetUrl,
        dropPercentage: req.dropPercentage,
        diagnosisSummary: `Failed to generate refresh plan: ${err.message}`,
        proposedNewTitle: req.currentTitle,
        proposedNewMetaDescription: '',
        missingTopics: [],
        newFaqsToAdd: [],
        actionPlan: [],
        provenance: 'DATA_UNAVAILABLE',
        reason: err.message,
      };
    }
  }

  /**
   * AI CTR Title & Meta Optimizer (No fake guaranteed lift claims)
   */
  public static async optimizeCtr(req: CtrOptimizationRequest): Promise<CtrOptimizationResponse> {
    const ai = getGenAI();

    if (!ai) {
      return {
        status: 'DATA_UNAVAILABLE',
        keyword: req.keyword,
        currentPosition: req.currentPosition,
        currentCtr: req.currentCtr,
        variations: [
          {
            variantName: 'High-Intent Modifier Variant',
            title: `${req.keyword}: 5 Production Strategies`,
            metaDescription: `Discover proven strategies for ${req.keyword}. Actionable blueprints and benchmarks for high-scale teams.`,
            strategicHypothesis: 'Targeting commercial intent modifiers directly increases qualified click-through rate.',
          },
          {
            variantName: 'Curiosity & Benchmark Variant',
            title: `How We Optimized ${req.keyword} (Real Benchmarks)`,
            metaDescription: `Detailed case study and architectural patterns for ${req.keyword}. See our production performance numbers.`,
            strategicHypothesis: 'First-party data and curiosity hooks stand out against generic listing pages.',
          },
        ],
        provenance: 'DATA_UNAVAILABLE',
        disclaimer: 'CTR improvements are hypotheses and subject to search intent, SERP feature layout, and seasonality.',
        reason: 'GEMINI_API_KEY is not configured.',
      };
    }

    try {
      const prompt = `
Generate 3 distinct Title and Meta Description testing variations for a page ranking on Google SERP:
- Target Keyword: "${req.keyword}"
- Current Title: "${req.currentTitle}"
- Current Meta Description: "${req.currentMetaDescription}"
- Current SERP Position: #${req.currentPosition}
- Current SERP CTR: ${req.currentCtr}%

Create 3 distinct strategic angles:
1. "Benefit & Outcome Focused" (Immediate value proposition)
2. "Technical Specificity & Depth" (Exact tools, numbers, or architectural patterns)
3. "Action-Oriented & Direct" (Clear verbs and CTA)

Return JSON matching:
{
  "variations": [
    {
      "variantName": "Angle Name",
      "title": "Title tag under 60 chars",
      "metaDescription": "Meta description under 155 chars",
      "strategicHypothesis": "Why this angle should improve CTR based on search psychology"
    }
  ]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const variations = Array.isArray(parsed.variations) ? parsed.variations : [];

      return {
        status: 'SUCCESS',
        keyword: req.keyword,
        currentPosition: req.currentPosition,
        currentCtr: req.currentCtr,
        variations,
        provenance: 'AI_INFERENCE',
        disclaimer: 'CTR variations are strategic hypotheses. Actual SERP lift must be measured via controlled experiments.',
      };
    } catch (err: any) {
      console.error('CTR Optimizer error:', err);
      return {
        status: 'ERROR',
        keyword: req.keyword,
        currentPosition: req.currentPosition,
        currentCtr: req.currentCtr,
        variations: [],
        provenance: 'DATA_UNAVAILABLE',
        disclaimer: 'Failed to generate CTR variations.',
        reason: err.message,
      };
    }
  }

  /**
   * Deterministic Schema Generator with Real Validation
   */
  public static generateAndValidateSchema(req: SchemaGenerationRequest): SchemaGenerationResponse {
    const { type, data } = req;
    const errors: string[] = [];
    const warnings: string[] = [];

    let jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': type,
    };

    switch (type) {
      case 'Article': {
        if (!data.headline) errors.push('Article schema requires a `headline` property.');
        if (!data.url) warnings.push('Article schema should include a canonical `url`.');
        if (!data.authorName) warnings.push('Google recommends specifying an author Person or Organization.');

        jsonLd = {
          ...jsonLd,
          headline: data.headline || '',
          url: data.url || '',
          author: {
            '@type': 'Person',
            name: data.authorName || 'Staff Writer',
          },
          publisher: {
            '@type': 'Organization',
            name: data.organizationName || 'Website Publisher',
            logo: {
              '@type': 'ImageObject',
              url: data.logoUrl || `${data.url || 'https://example.com'}/logo.png`,
            },
          },
          datePublished: data.datePublished || new Date().toISOString().split('T')[0],
          dateModified: data.dateModified || new Date().toISOString().split('T')[0],
        };
        break;
      }

      case 'FAQPage': {
        const faqItems: Array<{ question: string; answer: string }> = data.faqItems || [];
        if (!faqItems || faqItems.length === 0) {
          errors.push('FAQPage schema requires at least one Question and Answer pair in `mainEntity`.');
        }

        jsonLd = {
          ...jsonLd,
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        };
        break;
      }

      case 'Product': {
        if (!data.name) errors.push('Product schema requires a `name` property.');
        if (!data.price) warnings.push('Product schema should include an `offers` price.');

        jsonLd = {
          ...jsonLd,
          name: data.name || '',
          description: data.description || '',
          brand: {
            '@type': 'Brand',
            name: data.brand || 'Brand',
          },
          offers: {
            '@type': 'Offer',
            price: data.price || '0.00',
            priceCurrency: data.currency || 'USD',
            availability: 'https://schema.org/InStock',
          },
        };
        break;
      }

      case 'Organization': {
        if (!data.name) errors.push('Organization schema requires a `name` property.');
        jsonLd = {
          ...jsonLd,
          name: data.name || '',
          url: data.url || '',
          logo: data.logoUrl || '',
          sameAs: data.socialProfiles || [],
        };
        break;
      }

      case 'BreadcrumbList': {
        const items: Array<{ name: string; url: string }> = data.items || [];
        if (items.length === 0) {
          errors.push('BreadcrumbList requires at least one item in `itemListElement`.');
        }
        jsonLd = {
          ...jsonLd,
          itemListElement: items.map((item, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: item.name,
            item: item.url,
          })),
        };
        break;
      }

      default: {
        errors.push(`Unsupported schema type: ${type}`);
      }
    }

    const validationStatus = errors.length > 0 ? 'INVALID' : warnings.length > 0 ? 'VALID' : 'VALID';

    return {
      status: 'SUCCESS',
      schemaType: type,
      schemaJsonLd: jsonLd,
      validationStatus,
      validationErrors: errors,
      validationWarnings: warnings,
      provenance: 'CALCULATED',
    };
  }
}
