import { ActionStatus, AutomationRiskLevel } from '../../src/shared/contracts';

export interface SeoRecommendationEntity {
  id: string;
  websiteId: string;
  title: string;
  category: string;
  actionType: string;
  evidence: string;
  source: string;
  confidenceScore: number;
  impactScore: number;
  effortScore: number;
  riskScore: number;
  businessValue: number;
  automationLevel: AutomationRiskLevel;
  status: ActionStatus;
  createdAt: string;
}

export interface SeoTaskEntity {
  id: string;
  websiteId: string;
  recommendationId?: string;
  title: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  opportunityScore: number;
  automationLevel: AutomationRiskLevel;
  status: ActionStatus;
  reason: string;
  evidence: string;
  affectedUrls: string[];
  actionType: string;
  actionPayloadJson?: string;
  beforeStateJson?: string;
  afterStateJson?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

const recommendationsStore: Map<string, SeoRecommendationEntity> = new Map();
const tasksStore: Map<string, SeoTaskEntity> = new Map();
const executedIdempotencyKeys: Set<string> = new Set();

// Seed initial realistic recommendation and task for default website
const seedRecId = 'rec-title-opt-01';
recommendationsStore.set(seedRecId, {
  id: seedRecId,
  websiteId: 'site-techscale-prod',
  title: 'Optimize Sub-Optimal Page Title Lengths',
  category: 'METADATA',
  actionType: 'TITLE_UPDATE',
  evidence: 'Page title on /pricing is 18 characters, missing core commercial keywords.',
  source: 'Crawled Page Evidence',
  confidenceScore: 0.95,
  impactScore: 7,
  effortScore: 2,
  riskScore: 1,
  businessValue: 8,
  automationLevel: 'LEVEL_1_SAFE_AUTOMATION',
  status: 'RECOMMENDATION_ONLY',
  createdAt: new Date().toISOString(),
});

const seedTaskId = 'task-title-opt-01';
tasksStore.set(seedTaskId, {
  id: seedTaskId,
  websiteId: 'site-techscale-prod',
  recommendationId: seedRecId,
  title: 'Deploy High-CTR Title for /pricing',
  category: 'METADATA',
  priority: 'HIGH',
  opportunityScore: 78.4,
  automationLevel: 'LEVEL_1_SAFE_AUTOMATION',
  status: 'RECOMMENDATION_ONLY',
  reason: 'Increase commercial SERP relevance for "enterprise cloud pricing".',
  evidence: 'Current title: "Pricing | TechScale" (18 chars). Target CTR lift hypothesis: +15-20% impression capture.',
  affectedUrls: ['https://techscale.io/pricing'],
  actionType: 'TITLE_TAG_DEPLOY',
  actionPayloadJson: JSON.stringify({
    newTitle: 'Enterprise Cloud Pricing & Tier Comparison | TechScale',
  }),
  beforeStateJson: JSON.stringify({ title: 'Pricing | TechScale' }),
  afterStateJson: JSON.stringify({ title: 'Enterprise Cloud Pricing & Tier Comparison | TechScale' }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export class TaskRepository {
  public static async listRecommendations(websiteId: string): Promise<SeoRecommendationEntity[]> {
    return Array.from(recommendationsStore.values()).filter((r) => r.websiteId === websiteId);
  }

  public static async listTasks(websiteId: string): Promise<SeoTaskEntity[]> {
    return Array.from(tasksStore.values()).filter((t) => t.websiteId === websiteId);
  }

  public static async getTaskById(id: string, websiteId: string): Promise<SeoTaskEntity | null> {
    const task = tasksStore.get(id);
    if (!task || task.websiteId !== websiteId) return null;
    return task;
  }

  public static async updateTaskStatus(
    id: string,
    websiteId: string,
    status: ActionStatus
  ): Promise<SeoTaskEntity | null> {
    const task = tasksStore.get(id);
    if (!task || task.websiteId !== websiteId) return null;
    task.status = status;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  public static async executeTaskWithIdempotency(
    id: string,
    websiteId: string,
    idempotencyKey: string,
    isSimulation = false
  ): Promise<{ success: boolean; status: ActionStatus; message: string; duplicate?: boolean }> {
    if (executedIdempotencyKeys.has(idempotencyKey)) {
      return {
        success: true,
        status: isSimulation ? 'SIMULATION_ONLY' : 'BLOCKED_NO_INTEGRATION',
        message: 'Duplicate idempotent execution request recognized. No duplicate mutation executed.',
        duplicate: true,
      };
    }

    const task = tasksStore.get(id);
    if (!task || task.websiteId !== websiteId) {
      return { success: false, status: 'FAILED', message: 'Task not found or unauthorized' };
    }

    executedIdempotencyKeys.add(idempotencyKey);

    if (isSimulation) {
      task.status = 'SIMULATION_ONLY';
      task.updatedAt = new Date().toISOString();
      return {
        success: true,
        status: 'SIMULATION_ONLY',
        message: 'Simulation executed in sandbox mode. No real website mutation performed.',
      };
    }

    // If real CMS/Site integration is not connected
    task.status = 'BLOCKED_NO_INTEGRATION';
    task.updatedAt = new Date().toISOString();
    return {
      success: true,
      status: 'BLOCKED_NO_INTEGRATION',
      message: 'Action execution is blocked because WordPress/CMS integration is not connected. Requires verified CMS credentials.',
    };
  }
}
