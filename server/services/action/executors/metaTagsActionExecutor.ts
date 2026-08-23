import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

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

const liveMetaRegistry: Map<string, { title?: string; description?: string; robotsMeta?: string }> = new Map();

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
    const existing = liveMetaRegistry.get(target.targetUrl);
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
    const current = liveMetaRegistry.get(target.targetUrl) || {};
    const updated = {
      title: payload.title !== undefined ? payload.title : current.title,
      description: payload.description !== undefined ? payload.description : current.description,
      robotsMeta: payload.robotsMeta !== undefined ? payload.robotsMeta : current.robotsMeta,
    };
    liveMetaRegistry.set(target.targetUrl, updated);

    return {
      success: true,
      actionId: `exec-meta-${Date.now()}`,
      appliedState: updated,
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: 'Successfully deployed updated title and metadata',
      diffSummary: `Title: "${preState.title || ''}" -> "${updated.title || ''}" | Description: "${preState.description || ''}" -> "${updated.description || ''}"`,
    };
  }

  async rollback(target: ActionTarget, preState: MetaTagsPreState): Promise<RollbackResult> {
    if (preState.title || preState.description || preState.robotsMeta) {
      liveMetaRegistry.set(target.targetUrl, {
        title: preState.title || undefined,
        description: preState.description || undefined,
        robotsMeta: preState.robotsMeta || undefined,
      });
    } else {
      liveMetaRegistry.delete(target.targetUrl);
    }

    return {
      success: true,
      actionId: `rollback-meta-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: 'Successfully restored previous meta tags',
    };
  }

  public static getDeployedMeta(url: string) {
    return liveMetaRegistry.get(url);
  }
}
