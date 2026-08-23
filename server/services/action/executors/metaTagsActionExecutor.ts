import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';
import { CmsProviderRegistry } from '../cms/cmsProviderRegistry';

export interface MetaTagsPayload {
  targetUrl: string;
  title?: string;
  description?: string;
  robotsMeta?: string;
}

export interface MetaTagsPreState {
  targetUrl: string;
  title?: string | null;
  description?: string | null;
  robotsMeta?: string | null;
  capturedAt: string;
}

export class MetaTagsActionExecutor implements IActionExecutor<MetaTagsPayload, MetaTagsPreState> {
  readonly actionType: ActionType = 'SET_META_TAGS';

  async validate(target: ActionTarget, payload: MetaTagsPayload): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!payload.title && !payload.description && !payload.robotsMeta) {
      errors.push('At least one of title, description, or robotsMeta must be provided');
    }
    if (payload.title && payload.title.length > 200) {
      errors.push('Title exceeds maximum allowed length of 200 characters');
    }
    return { valid: errors.length === 0, errors };
  }

  async capturePreState(target: ActionTarget): Promise<MetaTagsPreState> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const existing = await cms.getMetaTags(target.targetUrl);
    return {
      targetUrl: target.targetUrl,
      title: existing?.title || null,
      description: existing?.description || null,
      robotsMeta: existing?.robotsMeta || null,
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: MetaTagsPayload,
    preState: MetaTagsPreState
  ): Promise<ExecutionResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.setMetaTags(target.targetUrl, {
      title: payload.title,
      description: payload.description,
      robotsMeta: payload.robotsMeta,
    });

    return {
      success: cmsRes.success,
      actionId: `exec-meta-${Date.now()}`,
      appliedState: cmsRes.appliedData,
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: cmsRes.message || 'Successfully deployed updated title and metadata',
      diffSummary: `Title: "${preState.title || ''}" -> "${payload.title || ''}" | Description: "${preState.description || ''}" -> "${payload.description || ''}" [${cms.platform}]`,
    };
  }

  async rollback(target: ActionTarget, preState: MetaTagsPreState): Promise<RollbackResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.revertMetaTags(target.targetUrl, preState);

    return {
      success: cmsRes.success,
      actionId: `rollback-meta-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: cmsRes.message || 'Successfully restored previous meta tags',
    };
  }

  public static getDeployedMeta(url: string, platform?: string) {
    const cms = CmsProviderRegistry.getProvider(platform);
    return (cms as any).deployedMeta?.get(url);
  }
}
