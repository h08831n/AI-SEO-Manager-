import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';
import { CmsProviderRegistry } from '../cms/cmsProviderRegistry';

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
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const existing = await cms.getRedirectRule(target.targetUrl);
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
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.createRedirectRule(payload.sourceUrl, payload.destinationUrl, payload.statusCode || 301);

    return {
      success: cmsRes.success,
      actionId: `exec-redirect-${Date.now()}`,
      appliedState: { destinationUrl: payload.destinationUrl, statusCode: payload.statusCode || 301 },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: cmsRes.message || `Created HTTP ${payload.statusCode || 301} redirect from ${payload.sourceUrl} -> ${payload.destinationUrl}`,
      diffSummary: `Redirect: ${payload.sourceUrl} -> ${payload.destinationUrl} (${payload.statusCode || 301}) [${cms.platform}]`,
    };
  }

  async rollback(target: ActionTarget, preState: RedirectPreState): Promise<RollbackResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const previousRule = preState.previousDestination && preState.previousStatusCode
      ? { destinationUrl: preState.previousDestination, statusCode: preState.previousStatusCode }
      : null;

    const cmsRes = await cms.revertRedirectRule(preState.sourceUrl, previousRule);

    return {
      success: cmsRes.success,
      actionId: `rollback-redirect-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: cmsRes.message || `Removed redirect rule for ${preState.sourceUrl}`,
    };
  }

  public static getDeployedRedirect(sourceUrl: string, platform?: string) {
    const cms = CmsProviderRegistry.getProvider(platform);
    return (cms as any).deployedRedirects?.get(sourceUrl);
  }
}
