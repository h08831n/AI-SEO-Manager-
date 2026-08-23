import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';
import { CmsProviderRegistry } from '../cms/cmsProviderRegistry';

export interface CanonicalPayload {
  targetUrl: string;
  canonicalUrl: string;
}

export interface CanonicalPreState {
  targetUrl: string;
  previousCanonicalUrl: string | null;
  capturedAt: string;
}

export class CanonicalActionExecutor implements IActionExecutor<CanonicalPayload, CanonicalPreState> {
  readonly actionType: ActionType = 'SET_CANONICAL_URL';

  async validate(target: ActionTarget, payload: CanonicalPayload): Promise<ValidationResult> {
    if (!payload.canonicalUrl) {
      return { valid: false, errors: ['canonicalUrl is required in payload'] };
    }
    try {
      new URL(payload.canonicalUrl);
    } catch {
      return { valid: false, errors: ['canonicalUrl must be a valid RFC-compliant URL'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<CanonicalPreState> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const existing = await cms.getCanonicalUrl(target.targetUrl);
    return {
      targetUrl: target.targetUrl,
      previousCanonicalUrl: existing,
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: CanonicalPayload,
    preState: CanonicalPreState
  ): Promise<ExecutionResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.setCanonicalUrl(target.targetUrl, payload.canonicalUrl);

    return {
      success: cmsRes.success,
      actionId: `exec-canon-${Date.now()}`,
      appliedState: { canonicalUrl: payload.canonicalUrl },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: cmsRes.message || `Successfully deployed canonical tag pointing to ${payload.canonicalUrl}`,
      diffSummary: `Canonical: ${preState.previousCanonicalUrl || '<none>'} -> ${payload.canonicalUrl} [${cms.platform}]`,
    };
  }

  async rollback(target: ActionTarget, preState: CanonicalPreState): Promise<RollbackResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.revertCanonicalUrl(target.targetUrl, preState.previousCanonicalUrl);

    return {
      success: cmsRes.success,
      actionId: `rollback-canon-${Date.now()}`,
      restoredState: { canonicalUrl: preState.previousCanonicalUrl },
      rolledBackAt: new Date(),
      message: cmsRes.message || `Successfully reverted canonical tag to ${preState.previousCanonicalUrl || '<none>'}`,
    };
  }

  public static getDeployedCanonical(url: string, platform?: string): string | undefined {
    const cms = CmsProviderRegistry.getProvider(platform);
    // Since getCanonicalUrl is async, we read from memory map directly or sync bridge
    return (cms as any).deployedCanonicals?.get(url);
  }
}
