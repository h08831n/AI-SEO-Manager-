import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

export interface RedirectPayload {
  sourceUrl: string;
  destinationUrl: string;
  statusCode?: 301 | 302 | 307 | 308;
}

export interface RedirectPreState {
  sourceUrl: string;
  previousDestination: string | null;
  previousStatusCode: number | null;
  capturedAt: string;
}

const liveRedirectMap: Map<string, { destinationUrl: string; statusCode: number }> = new Map();

export class RedirectActionExecutor implements IActionExecutor<RedirectPayload, RedirectPreState> {
  readonly actionType: ActionType = 'CREATE_REDIRECT_RULE';

  async validate(target: ActionTarget, payload: RedirectPayload): Promise<ValidationResult> {
    if (!payload.sourceUrl || !payload.destinationUrl) {
      return { valid: false, errors: ['sourceUrl and destinationUrl are required'] };
    }
    if (payload.sourceUrl === payload.destinationUrl) {
      return { valid: false, errors: ['Redirect loop detected: sourceUrl cannot equal destinationUrl'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<RedirectPreState> {
    const existing = liveRedirectMap.get(target.targetUrl);
    return {
      sourceUrl: target.targetUrl,
      previousDestination: existing?.destinationUrl || null,
      previousStatusCode: existing?.statusCode || null,
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: RedirectPayload,
    preState: RedirectPreState
  ): Promise<ExecutionResult> {
    const rule = {
      destinationUrl: payload.destinationUrl,
      statusCode: payload.statusCode || 301,
    };
    liveRedirectMap.set(payload.sourceUrl, rule);

    return {
      success: true,
      actionId: `exec-redirect-${Date.now()}`,
      appliedState: rule,
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: `Created HTTP ${rule.statusCode} redirect from ${payload.sourceUrl} -> ${payload.destinationUrl}`,
      diffSummary: `Redirect: ${payload.sourceUrl} -> ${payload.destinationUrl} (${rule.statusCode})`,
    };
  }

  async rollback(target: ActionTarget, preState: RedirectPreState): Promise<RollbackResult> {
    if (preState.previousDestination && preState.previousStatusCode) {
      liveRedirectMap.set(preState.sourceUrl, {
        destinationUrl: preState.previousDestination,
        statusCode: preState.previousStatusCode,
      });
    } else {
      liveRedirectMap.delete(preState.sourceUrl);
    }

    return {
      success: true,
      actionId: `rollback-redirect-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: `Removed redirect rule for ${preState.sourceUrl}`,
    };
  }

  public static getDeployedRedirect(sourceUrl: string) {
    return liveRedirectMap.get(sourceUrl);
  }
}
